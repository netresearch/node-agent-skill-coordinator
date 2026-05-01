import { readFile, rename, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const SKILLS_START_MARKER = '<!-- SKILLS_TABLE_START -->';
const SKILLS_END_MARKER = '<!-- SKILLS_TABLE_END -->';

// Replace the entire <skills_system>...</skills_system> block on each run.
// The Composer plugin uses the same wrapping element, so AGENTS.md remains
// drop-in compatible: an agent reading the file doesn't care which side
// (composer or npm) wrote the block, and a project that uses both
// gets last-writer-wins semantics. Hybrid PHP/JS projects should run
// the two tools sequentially; cross-ecosystem merging is a future
// enhancement that requires a coordinated marker change in both repos.
const SKILLS_SYSTEM_RE = /<skills_system[^>]*>[\s\S]*?<\/skills_system>/;

/**
 * Build the XML block listing skills. Element/attribute content is escaped
 * with XML 1.0 character entities; we deliberately escape the apostrophe as
 * `&apos;` to match PHP's `htmlspecialchars(ENT_XML1 | ENT_QUOTES)` so the
 * Composer-plugin output and ours are byte-identical for the same skills.
 *
 * @param {import('./discovery.js').Skill[]} skills
 * @returns {string}
 */
export function generateSkillsXml(skills) {
  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));

  let out = '<skills_system priority="1">\n\n';
  out += '## Available Skills\n\n';
  out += SKILLS_START_MARKER + '\n';
  out += '<usage>\n';
  out +=
    'When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.\n\n';
  out += 'How to use skills:\n';
  out += '- Invoke: Bash("npx agent-skills read <skill-name>")\n';
  out += '- The skill content will load with detailed instructions on how to complete the task\n';
  out += '- IMPORTANT: Always cd to the Base Directory shown in output before executing scripts or accessing bundled resources\n\n';
  out += 'Usage notes:\n';
  out += '- For project-specific tasks, only use skills listed in <available_skills> below\n';
  out += '- Note: Native capabilities (e.g., via the Skill tool) remain available alongside project skills\n';
  out += '- Do not invoke a skill that is already loaded in your context\n';
  out += '- Each skill invocation is stateless\n';
  out += '</usage>\n\n';
  out += '<available_skills>\n';

  if (sorted.length > 0) {
    out += '\n';
    sorted.forEach((skill, i) => {
      out += '<skill>\n';
      out += `<name>${xmlEscape(skill.name)}</name>\n`;
      out += `<description>${xmlEscape(skill.description)}</description>\n`;
      out += `<location>${xmlEscape(skill.location)}</location>\n`;
      out += '</skill>\n';
      if (i < sorted.length - 1) out += '\n';
    });
  }

  out += '\n</available_skills>\n';
  out += SKILLS_END_MARKER + '\n\n';
  out += '</skills_system>';

  return out;
}

/**
 * Update an existing AGENTS.md (or create one) with the given skills.
 *
 * Atomic: writes to a randomized temp file then renames, so a crash
 * mid-write never leaves a half-written AGENTS.md behind. Two
 * concurrent runs each pick their own temp suffix, so they don't
 * collide on the same temp filename — though the rename itself is
 * still last-writer-wins.
 *
 * @param {string} agentsMdPath
 * @param {import('./discovery.js').Skill[]} skills
 * @returns {Promise<void>}
 */
export async function updateAgentsMd(agentsMdPath, skills) {
  const block = generateSkillsXml(skills);

  let next;
  if (existsSync(agentsMdPath)) {
    const existing = await readFile(agentsMdPath, 'utf8');
    if (SKILLS_SYSTEM_RE.test(existing)) {
      next = existing.replace(SKILLS_SYSTEM_RE, block);
    } else {
      next = existing.replace(/\s+$/, '') + '\n\n' + block + '\n';
    }
  } else {
    next = block + '\n';
  }

  const tempPath = `${agentsMdPath}.skill-agents.${randomBytes(8).toString('hex')}`;
  try {
    await writeFile(tempPath, next, 'utf8');
    await rename(tempPath, agentsMdPath);
  } catch (err) {
    await unlink(tempPath).catch(() => {});
    throw err;
  }
}

/**
 * Escape for both XML element content and attribute values. Includes
 * `&apos;` (which `&quot;` alone would not cover) to match PHP's
 * `ENT_XML1 | ENT_QUOTES` behavior used by the Composer plugin.
 *
 * @param {string} s
 */
function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
