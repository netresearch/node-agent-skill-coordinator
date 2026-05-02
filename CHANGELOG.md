# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-02

### Added

- Initial release. Sibling of `netresearch/composer-agent-skill-plugin` for the Node ecosystem.
- `postinstall` hook scans `node_modules` and writes an `AGENTS.md` block listing discovered skills.
- Skill discovery via `aiAgentSkill` field (string or array) in `package.json`, or the `ai-agent-skill` keyword + default `SKILL.md`.
- Frontmatter validation with the same rules as the Composer plugin: kebab-case `name` ≤64 chars, `description` ≤1024 chars with C0/DEL/bidi-override rejection.
- Path safety: rejects absolute paths, `..` traversal, and symlinks that escape the package directory.
- Atomic `AGENTS.md` writes (temp file + rename).
- CLI commands: `list`, `read <name>`, `install`.
- Support for npm/yarn classic flat layout, scoped packages (`@scope/name`), pnpm content-addressed `.pnpm/` store, and workspace symlinks (deduped via `realpath`).
