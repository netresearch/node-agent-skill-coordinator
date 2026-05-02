# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-05-02

### Fixed

- `bin` path no longer carries a `./` prefix; npm 11 silently strips entries with that prefix from the published manifest, breaking `npx agent-skills`.

### Changed

- Release workflow uses npm OIDC Trusted Publishing instead of a long-lived org token.

> Note: v0.1.0 was tagged on GitHub but never reached npm — the publish failed because of the two issues fixed in 0.1.1. 0.1.1 is the first version on the npm registry.

## [0.1.0] - 2026-05-02

> Tagged on GitHub but never published to npm. See 0.1.1 for the first npm release.

### Added

- Initial release. Sibling of `netresearch/composer-agent-skill-plugin` for the Node ecosystem.
- `postinstall` hook scans `node_modules` and writes an `AGENTS.md` block listing discovered skills.
- Skill discovery via `aiAgentSkill` field (string or array) in `package.json`, or the `ai-agent-skill` keyword + default `SKILL.md`.
- Frontmatter validation with the same rules as the Composer plugin: kebab-case `name` ≤64 chars, `description` ≤1024 chars with C0/DEL/bidi-override rejection.
- Path safety: rejects absolute paths, `..` traversal, and symlinks that escape the package directory.
- Atomic `AGENTS.md` writes (temp file + rename).
- CLI commands: `list`, `read <name>`, `install`.
- Support for npm/yarn classic flat layout, scoped packages (`@scope/name`), pnpm content-addressed `.pnpm/` store, and workspace symlinks (deduped via `realpath`).
