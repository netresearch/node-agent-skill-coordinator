import { readdir, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * @typedef {Object} PackageInfo
 * @property {string} name              package.json "name"
 * @property {string} version           package.json "version" (or "0.0.0" if absent)
 * @property {string} installPath       absolute path to the package directory
 * @property {string | string[] | null} aiAgentSkill  raw value of the field
 * @property {boolean} hasKeyword       whether keywords includes "ai-agent-skill"
 */

const SKILL_FIELD = 'aiAgentSkill';
const SKILL_KEYWORD = 'ai-agent-skill';

/**
 * Decide whether a package declares one or more skills. Mirrors the
 * Composer plugin's PackageInfo::declaresSkills(): the explicit field
 * takes precedence, and the keyword acts as an opt-in for packages that
 * just drop a SKILL.md at root.
 *
 * @param {PackageInfo} pkg
 */
export function declaresSkills(pkg) {
  return pkg.aiAgentSkill !== null || pkg.hasKeyword;
}

/**
 * Walk a project's `node_modules` and yield every installed package.
 *
 * Handles three layouts:
 *   - npm/yarn classic flat: `node_modules/<name>` and `node_modules/@<scope>/<name>`
 *   - pnpm content-addressed: `node_modules/.pnpm/<id>/node_modules/[<scope>/]<name>`
 *   - workspace symlinks (via realpath dedup)
 *
 * Symlinks are followed and deduped by their realpath so a workspace
 * package that's symlinked from the project root isn't yielded twice.
 *
 * @param {string} nodeModulesDir absolute path to project's node_modules
 * @returns {AsyncGenerator<PackageInfo>}
 */
export async function* iterPackages(nodeModulesDir) {
  /** @type {Set<string>} */
  const visited = new Set();

  async function* visit(/** @type {string} */ dir) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!(entry.isDirectory() || entry.isSymbolicLink())) continue;

      const name = entry.name;
      // Skip dot-dirs except .pnpm (which holds pnpm's content-addressed store).
      if (name.startsWith('.') && name !== '.pnpm') continue;

      const sub = join(dir, name);

      if (name === '.pnpm') {
        // pnpm: each `<id>/node_modules` may contain its own packages.
        const ids = await readdir(sub, { withFileTypes: true }).catch(() => []);
        for (const id of ids) {
          if (!id.isDirectory()) continue;
          const inner = join(sub, id.name, 'node_modules');
          yield* visit(inner);
        }
        continue;
      }

      if (name.startsWith('@')) {
        // Scoped namespace: descend one more level.
        const scoped = await readdir(sub, { withFileTypes: true }).catch(() => []);
        for (const child of scoped) {
          if (!(child.isDirectory() || child.isSymbolicLink())) continue;
          if (child.name.startsWith('.')) continue;
          const pkgDir = join(sub, child.name);
          const pkg = await readPackage(pkgDir, visited);
          if (pkg) yield pkg;
        }
        continue;
      }

      // Regular top-level package.
      const pkg = await readPackage(sub, visited);
      if (pkg) yield pkg;
    }
  }

  yield* visit(nodeModulesDir);
}

/**
 * Read a package.json from a directory and return a normalized PackageInfo,
 * or null if the directory doesn't look like a package or has already been
 * yielded under a different symlink path.
 *
 * @param {string} pkgDir
 * @param {Set<string>} visited
 * @returns {Promise<PackageInfo | null>}
 */
async function readPackage(pkgDir, visited) {
  // Dedup by realpath so workspace-linked or pnpm-deduped packages aren't
  // counted twice when they appear under multiple paths.
  let real;
  try {
    real = await realpath(pkgDir);
  } catch {
    return null;
  }
  if (visited.has(real)) return null;
  visited.add(real);

  let raw;
  try {
    raw = await readFile(join(real, 'package.json'), 'utf8');
  } catch {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  if (typeof parsed.name !== 'string' || parsed.name === '') return null;

  const aiAgentSkill = normalizeSkillField(parsed[SKILL_FIELD]);
  const hasKeyword = Array.isArray(parsed.keywords) && parsed.keywords.includes(SKILL_KEYWORD);

  return {
    name: parsed.name,
    version: typeof parsed.version === 'string' ? parsed.version : '0.0.0',
    installPath: real,
    aiAgentSkill,
    hasKeyword,
  };
}

/**
 * @param {unknown} value
 * @returns {string | string[] | null}
 */
function normalizeSkillField(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    return value.length > 0 ? value : null;
  }
  return null;
}
