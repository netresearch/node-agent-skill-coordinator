# Database Analyzer Skill — example npm package

Reference implementation of an AI agent skill package for the [Node Agent Skill Coordinator](../../).

This is the npm sibling of the [`database-analyzer-skill` example in the Composer plugin](https://github.com/netresearch/composer-agent-skill-plugin/tree/main/examples/database-analyzer-skill). The `SKILL.md` file is identical between the two ecosystems — only the package manifest changes (`composer.json` → `package.json`).

## Package structure

```
database-analyzer-skill/
├── package.json     Declares the skill via aiAgentSkill + keyword
├── SKILL.md         Skill definition (Anthropic SKILL.md schema)
├── README.md        This file
└── (optional) references/, scripts/, assets/
```

## Key components

### package.json

```json
{
  "name": "@you/your-skill",
  "version": "1.0.0",
  "keywords": ["ai-agent-skill"],
  "aiAgentSkill": "SKILL.md",
  "files": ["SKILL.md"]
}
```

- **`aiAgentSkill`**: relative path to a `SKILL.md` (or array of paths for multi-skill packages). This is the authoritative declaration.
- **`keywords: ["ai-agent-skill"]`**: enables npm-search discovery and acts as a fallback signal — packages without `aiAgentSkill` but with this keyword fall back to `SKILL.md` at the package root.
- **`files`**: allow-list for `npm publish` so consumers actually receive the skill content.

### SKILL.md

Follows the Anthropic [SKILL.md schema](https://code.claude.com/docs/en/skills#write-skill-md):

```yaml
---
name: database-analyzer        # kebab-case, max 64 chars
description: Short blurb describing what the skill does and when to use it (max 1024 chars).
---

# Body in Markdown
```

Validation rules enforced by the coordinator (mirror the Composer plugin):

- `name`: `^[a-z0-9-]{1,64}$`
- `description`: ≤1024 characters; no control characters or bidi-override codepoints

## How discovery works

1. **Install**: a project adds `@netresearch/agent-skill-coordinator` and your skill package as devDependencies.
2. **Postinstall**: the coordinator scans `node_modules`, validates each declared skill, and writes a `<skills_system>` block into `AGENTS.md`.
3. **Agent invocation**: the agent reads `AGENTS.md`, calls `npx agent-skills read <name>` to load full skill content.

## Multiple skills per package

For packages that ship more than one skill:

```json
{
  "aiAgentSkill": [
    "skills/analyzer/SKILL.md",
    "skills/optimizer/SKILL.md"
  ],
  "files": ["skills/"]
}
```

## Local testing

```bash
# In a test project:
npm init -y
npm install --save-dev /path/to/this/example/dir
npm install --save-dev @netresearch/agent-skill-coordinator

# AGENTS.md should now list `database-analyzer`.
npx agent-skills list
npx agent-skills read database-analyzer
```

## Publishing

```bash
# Tag and push
git tag v1.0.0
git push --tags

# Publish to npm
npm publish --access public
```

## Tips for great skills

✅ Do:
- Provide step-by-step instructions and concrete examples.
- Document prerequisites and required tools/credentials.
- Keep descriptions focused: what + when, not how.
- Test thoroughly before publishing.

❌ Don't:
- Use vague descriptions ("database helper").
- Include outdated information.
- Make skills too broad or too narrow to be useful.

## License

MIT — feel free to use this as a template for your own skills.
