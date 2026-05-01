#!/usr/bin/env node
// Postinstall entry. Runs after `npm install` finishes in any project
// that has @netresearch/agent-skill-coordinator as a dependency.
//
// Failure here MUST NOT abort the user's install — we catch everything
// and exit 0. The cost of a stale AGENTS.md is annoying; the cost of
// breaking `npm install` would be unforgivable.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { discoverSkills } from '../src/discovery.js';
import { updateAgentsMd } from '../src/generator.js';

const TAG = '[agent-skill-coordinator]';

async function main() {
  // npm/yarn/pnpm all set INIT_CWD to the directory where the user
  // invoked the install command. process.cwd() during postinstall is
  // the *installing package's* dir, not the project root, so prefer
  // INIT_CWD. Fall back to cwd for unusual harnesses.
  const projectRoot = process.env.INIT_CWD || process.cwd();

  const nodeModulesDir = join(projectRoot, 'node_modules');
  if (!existsSync(nodeModulesDir)) {
    // No node_modules → nothing to scan. This typically means we're
    // running `npm install` inside this very repo (development of the
    // coordinator itself) before deps have been installed.
    return;
  }

  /** @type {string[]} */
  const warnings = [];
  const { skills } = await discoverSkills(nodeModulesDir, {
    onWarning: (msg) => warnings.push(msg),
  });

  const agentsMdPath = join(projectRoot, 'AGENTS.md');
  await updateAgentsMd(agentsMdPath, skills);

  if (warnings.length > 0) {
    process.stderr.write(`\n${TAG} Warnings:\n`);
    for (const w of warnings) process.stderr.write(`  ${w}\n`);
    process.stderr.write('\n');
  }

  if (skills.length > 0) {
    const plural = skills.length === 1 ? '' : 's';
    process.stdout.write(`${TAG} ${skills.length} skill${plural} registered in AGENTS.md\n`);
  }
}

main().catch((err) => {
  // Never throw from a postinstall — log and continue.
  process.stderr.write(`${TAG} error: ${err && err.message ? err.message : String(err)}\n`);
  process.exit(0);
});
