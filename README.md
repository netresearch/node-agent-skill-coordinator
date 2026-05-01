# Node Agent Skill Coordinator

A small Node package that discovers AI agent skills shipped inside installed npm packages and registers them in the project's `AGENTS.md`. Sibling of [`netresearch/composer-agent-skill-plugin`](https://github.com/netresearch/composer-agent-skill-plugin) — same skill format, same `AGENTS.md` block, just for the Node ecosystem.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-blue)](package.json)

## What it does

When you `npm install` a package that declares one or more skills, this coordinator's `postinstall` hook scans `node_modules`, validates the skill metadata, and writes a managed block into `AGENTS.md` listing every discovered skill. Agents like Claude Code read that block to know which skills are available in the project.

## Install

In a consuming project, add the coordinator and any skill packages as dev dependencies:

```json
{
  "devDependencies": {
    "@netresearch/agent-skill-coordinator": "^0.1",
    "@you/some-skill-package": "^1.0"
  }
}
```

For pnpm, allowlist the postinstall script once:

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["@netresearch/agent-skill-coordinator"]
  }
}
```

For Yarn Berry, set `nodeLinker: node-modules` in `.yarnrc.yml` (Plug'n'Play mode is not supported — there is no `node_modules` to scan).

After `npm install` completes, an `AGENTS.md` block listing all discovered skills is created/updated automatically.

## Shipping a skill in your npm package

Skills are plain markdown files with YAML frontmatter (Anthropic skill convention).

**`SKILL.md`:**

```markdown
---
name: my-skill
description: Short description of what this skill does and when to use it.
---

# My Skill

Detailed instructions, examples, and any bundled resources go here.
```

**Frontmatter rules** (mirror the Composer plugin):

- `name` (required): kebab-case, `[a-z0-9-]{1,64}`.
- `description` (required): ≤1024 characters, no control characters or bidi-override codepoints.

**`package.json`** declares the skill via `aiAgentSkill` (path, or array of paths) and includes the `ai-agent-skill` keyword for npm-search discoverability:

```json
{
  "name": "@you/my-skill",
  "version": "1.0.0",
  "keywords": ["ai-agent-skill"],
  "aiAgentSkill": "SKILL.md",
  "files": ["SKILL.md"]
}
```

For multi-skill packages:

```json
{
  "aiAgentSkill": ["skills/foo/SKILL.md", "skills/bar/SKILL.md"]
}
```

If `aiAgentSkill` is omitted, the coordinator falls back to `SKILL.md` at the package root (provided the `ai-agent-skill` keyword is present).

## CLI

```
agent-skills list [--json]      List discovered skills
agent-skills read <name>        Print a skill's SKILL.md and metadata
agent-skills install            Regenerate AGENTS.md (manual trigger; same as postinstall)
agent-skills --help             Show help
agent-skills --version          Show version
```

The `read` command prints a header with absolute paths so an agent can `cd` to the base directory before invoking bundled scripts.

## Programmatic API

```js
import { discoverSkills, updateAgentsMd } from '@netresearch/agent-skill-coordinator';

const { skills } = await discoverSkills('./node_modules', {
  onWarning: (msg) => console.warn(msg),
});

await updateAgentsMd('./AGENTS.md', skills);
```

## How the AGENTS.md block looks

The coordinator writes a `<skills_system>` block bracketed by `<!-- SKILLS_TABLE_START -->` / `<!-- SKILLS_TABLE_END -->`. Existing content outside the block is preserved. The XML structure is byte-identical to the Composer plugin's output (same wrapper element, same skill schema), so any agent that already reads the Composer plugin's output works here unchanged.

## Compatibility

| Package manager                                    | Status                                                       |
| -------------------------------------------------- | ------------------------------------------------------------ |
| npm (≥7)                                           | ✅                                                           |
| pnpm                                               | ✅ (add coordinator to `pnpm.onlyBuiltDependencies`)         |
| Yarn Classic                                       | ✅                                                           |
| Yarn Berry (`nodeLinker: node-modules`)            | ✅                                                           |
| Yarn Berry (default Plug'n'Play)                   | ❌ (no `node_modules` to scan; use `nodeLinker: node-modules`) |
| Bun                                                | ✅                                                           |

## Hybrid PHP / JS projects

If your project also uses [`netresearch/composer-agent-skill-plugin`](https://github.com/netresearch/composer-agent-skill-plugin), both tools maintain the same `<skills_system>` block in `AGENTS.md`. They overwrite each other on every run — last writer wins. For now, run them sequentially when you change skills on either side. Cross-ecosystem merging is a future enhancement.

## Why a coordinator package and not `postinstall` per skill

- One install-time trust prompt covers all current and future skills.
- One `AGENTS.md` write per install, no race between concurrent skill packages.
- Skill packages stay pure data — no scripts, smaller security surface.

This mirrors how `husky`, `simple-git-hooks`, and other npm install-time tools work.

## License

MIT — Copyright (c) 2026 Netresearch DTT GmbH. See [LICENSE](LICENSE).
