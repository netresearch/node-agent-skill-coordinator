import { readFile, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { iterPackages, declaresSkills } from './scanner.js';
import { parseFrontmatter } from './parser.js';
import { validateFrontmatter } from './validator.js';
import { isAbsoluteUnsafe, hasTraversal, isWithinPackage, toPosix } from './pathSafety.js';

/**
 * @typedef {Object} Skill
 * @property {string} name
 * @property {string} description
 * @property {string} location  absolute base directory containing SKILL.md
 * @property {string} package   declaring package name
 * @property {string} version   declaring package version
 * @property {string} file      relative file path inside the package
 */

const DEFAULT_SKILL_FILE = 'SKILL.md';

/**
 * Discover all valid skills in a project's node_modules.
 *
 * @param {string} nodeModulesDir
 * @param {{ onWarning?: (msg: string) => void }} [opts]
 * @returns {Promise<{ skills: Skill[] }>}
 */
export async function discoverSkills(nodeModulesDir, opts = {}) {
  const onWarning = opts.onWarning ?? (() => {});

  /** @type {Map<string, Skill>} */
  const byName = new Map();

  for await (const pkg of iterPackages(nodeModulesDir)) {
    if (!declaresSkills(pkg)) continue;

    const paths = resolveSkillPaths(pkg, onWarning);
    for (const relPath of paths) {
      const skill = await readSkill(pkg, relPath, onWarning);
      if (!skill) continue;

      const existing = byName.get(skill.name);
      if (existing) {
        onWarning(
          `[${pkg.name}] Duplicate skill name '${skill.name}' (also in ${existing.package}). Using ${pkg.name} (last one wins).`,
        );
      }
      byName.set(skill.name, skill);
    }
  }

  const skills = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { skills };
}

/**
 * @param {import('./scanner.js').PackageInfo} pkg
 * @param {(msg: string) => void} onWarning
 * @returns {string[]}
 */
function resolveSkillPaths(pkg, onWarning) {
  const field = pkg.aiAgentSkill;

  if (field === null) {
    // Keyword-only: default to SKILL.md at root.
    return [DEFAULT_SKILL_FILE];
  }

  /** @type {string[]} */
  const candidates = typeof field === 'string' ? [field] : field;
  /** @type {string[]} */
  const safe = [];

  for (const p of candidates) {
    if (isAbsoluteUnsafe(p)) {
      onWarning(`[${pkg.name}] Absolute paths not allowed in '${'aiAgentSkill'}': '${p}'.`);
      continue;
    }
    if (hasTraversal(p)) {
      onWarning(`[${pkg.name}] Path traversal '..' rejected in 'aiAgentSkill': '${p}'.`);
      continue;
    }
    safe.push(p);
  }

  return safe;
}

/**
 * @param {import('./scanner.js').PackageInfo} pkg
 * @param {string} relPath
 * @param {(msg: string) => void} onWarning
 * @returns {Promise<Skill | null>}
 */
async function readSkill(pkg, relPath, onWarning) {
  const abs = join(pkg.installPath, relPath);

  if (!existsSync(abs)) {
    const hint =
      relPath === DEFAULT_SKILL_FILE
        ? 'Expected SKILL.md in package root (convention).'
        : "Check 'aiAgentSkill' configuration in package.json.";
    onWarning(`[${pkg.name}] SKILL.md not found at '${relPath}'. ${hint}`);
    return null;
  }

  // Symlink-escape defense: even after rejecting '..', a symlink could
  // point outside the package. realpath the file, ensure it's rooted in
  // the realpath of the package install dir.
  if (!(await isWithinPackage(pkg.installPath, abs))) {
    onWarning(
      `[${pkg.name}] Skill path '${relPath}' resolves outside the package directory (symlink escape or unresolvable).`,
    );
    return null;
  }

  let contents;
  try {
    contents = await readFile(abs, 'utf8');
  } catch (err) {
    onWarning(`[${pkg.name}] Failed to read '${relPath}': ${(err && /** @type {Error} */ (err).message) || 'unknown error'}`);
    return null;
  }

  const parsed = parseFrontmatter(contents);
  if ('error' in parsed) {
    onWarning(`[${pkg.name}] Invalid frontmatter in '${relPath}': ${parsed.error}`);
    return null;
  }

  const validationError = validateFrontmatter(parsed.frontmatter);
  if (validationError !== null) {
    onWarning(`[${pkg.name}] Invalid frontmatter in '${relPath}': ${validationError}`);
    return null;
  }

  // Base directory = directory containing SKILL.md, resolved.
  const baseDir = dirname(abs);
  let resolvedBase = baseDir;
  try {
    resolvedBase = await realpath(baseDir);
  } catch {
    // fall through with unresolved
  }

  return {
    name: parsed.frontmatter.name,
    description: parsed.frontmatter.description,
    location: toPosix(resolvedBase),
    package: pkg.name,
    version: pkg.version,
    file: basename(relPath),
  };
}
