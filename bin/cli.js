#!/usr/bin/env node
// CLI for agents and operators. Mirrors the Composer plugin's commands:
//   agent-skills list             — enumerate discovered skills
//   agent-skills read <name>      — print SKILL.md (preceded by a metadata header)
//   agent-skills install          — regenerate AGENTS.md (manual trigger; same as postinstall)
//
// Output is intentionally plain so AI agents can parse it: `list --json` for
// machine consumption, `read` prefixes a header with absolute paths so the
// agent knows where to cd before running bundled scripts.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { discoverSkills } from '../src/discovery.js';
import { updateAgentsMd } from '../src/generator.js';

const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
  printHelp();
  process.exit(0);
}

if (cmd === '--version' || cmd === '-v' || cmd === 'version') {
  printVersion();
  process.exit(0);
}

try {
  if (cmd === 'list') {
    await runList(args.slice(1));
  } else if (cmd === 'read') {
    await runRead(args.slice(1));
  } else if (cmd === 'install') {
    await runInstall();
  } else {
    process.stderr.write(`Unknown command: ${cmd}\n\n`);
    printHelp();
    process.exit(2);
  }
} catch (err) {
  process.stderr.write(`Error: ${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
}

function projectRoot() {
  // CLI is invoked by users / agents in their project directory, so cwd
  // is the right anchor here (unlike the postinstall script).
  return process.cwd();
}

function nodeModulesDir() {
  const dir = join(projectRoot(), 'node_modules');
  if (!existsSync(dir)) {
    throw new Error(`No node_modules found at ${dir}. Run \`npm install\` first.`);
  }
  return dir;
}

async function runList(/** @type {string[]} */ rest) {
  const wantJson = rest.includes('--json');
  /** @type {string[]} */
  const warnings = [];
  const { skills } = await discoverSkills(nodeModulesDir(), {
    onWarning: (msg) => warnings.push(msg),
  });

  if (wantJson) {
    process.stdout.write(JSON.stringify({ skills, warnings }, null, 2) + '\n');
    return;
  }

  if (skills.length === 0) {
    process.stdout.write('No skills discovered.\n');
  } else {
    process.stdout.write(`Discovered ${skills.length} skill(s):\n\n`);
    for (const s of skills) {
      process.stdout.write(`- ${s.name} (${s.package}@${s.version})\n`);
      process.stdout.write(`    ${s.description}\n`);
      process.stdout.write(`    location: ${s.location}\n`);
    }
  }
  for (const w of warnings) process.stderr.write(`warning: ${w}\n`);
}

async function runRead(/** @type {string[]} */ rest) {
  const target = rest[0];
  if (!target) throw new Error('Usage: agent-skills read <skill-name>');

  const { skills } = await discoverSkills(nodeModulesDir(), { onWarning: () => {} });
  const skill = skills.find((s) => s.name === target);
  if (!skill) {
    throw new Error(`Skill '${target}' not found. Run 'agent-skills list' to see available skills.`);
  }

  const filePath = join(skill.location, skill.file);
  if (!existsSync(filePath)) {
    throw new Error(`SKILL.md not found at ${filePath}.`);
  }
  const contents = readFileSync(filePath, 'utf8');

  // Header with absolute paths so the agent knows where to cd before
  // touching bundled scripts/assets referenced inside the skill.
  process.stdout.write(`# ${skill.name}\n`);
  process.stdout.write(`Package: ${skill.package}@${skill.version}\n`);
  process.stdout.write(`Base Directory: ${skill.location}\n`);
  process.stdout.write(`File: ${filePath}\n\n`);
  process.stdout.write('---\n\n');
  process.stdout.write(contents);
  if (!contents.endsWith('\n')) process.stdout.write('\n');
}

async function runInstall() {
  /** @type {string[]} */
  const warnings = [];
  const { skills } = await discoverSkills(nodeModulesDir(), {
    onWarning: (msg) => warnings.push(msg),
  });
  const agentsMdPath = join(projectRoot(), 'AGENTS.md');
  await updateAgentsMd(agentsMdPath, skills);

  for (const w of warnings) process.stderr.write(`warning: ${w}\n`);
  const plural = skills.length === 1 ? '' : 's';
  process.stdout.write(`${skills.length} skill${plural} registered in ${agentsMdPath}\n`);
}

function printHelp() {
  process.stdout.write(
    [
      'agent-skills — discover AI agent skills declared by installed npm packages',
      '',
      'Usage:',
      '  agent-skills list [--json]      List discovered skills',
      '  agent-skills read <name>        Print a skill\'s SKILL.md and metadata',
      '  agent-skills install            Regenerate AGENTS.md (manual trigger)',
      '  agent-skills --help             Show this help',
      '  agent-skills --version          Show version',
      '',
    ].join('\n'),
  );
}

function printVersion() {
  const pkgPath = resolve(import.meta.dirname ?? '', '..', 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    process.stdout.write(`${pkg.version}\n`);
  } catch {
    process.stdout.write('unknown\n');
  }
}
