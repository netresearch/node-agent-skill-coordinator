import { realpath } from 'node:fs/promises';
import { sep, posix as posixPath } from 'node:path';

/**
 * Reject absolute paths (Unix `/foo` or Windows `C:\foo` / `C:/foo`).
 * Skill paths declared in package.json must be relative to the package root.
 *
 * @param {string} p
 */
export function isAbsoluteUnsafe(p) {
  if (p.startsWith('/') || p.startsWith('\\')) return true;
  // Windows drive letter: C: or C:\ etc.
  if (p.length > 1 && p[1] === ':') return true;
  return false;
}

/**
 * Reject relative paths that contain a `..` segment. We split on both `/`
 * and `\` so cross-platform paths are caught regardless of separator.
 * "foo..bar" inside a single segment is fine — only segments that are
 * exactly ".." are rejected.
 *
 * @param {string} p
 */
export function hasTraversal(p) {
  return p.split(/[\\/]+/).some((seg) => seg === '..');
}

/**
 * After a path has been resolved via realpath, verify it lives inside
 * the resolved package directory. This blocks symlink-escape attacks
 * where `package/skills/foo.md` is a symlink to `/etc/passwd` or
 * `../../../somewhere-outside-the-package`.
 *
 * Fails CLOSED: if either realpath fails, returns false.
 *
 * @param {string} packageDir
 * @param {string} candidate
 * @returns {Promise<boolean>}
 */
export async function isWithinPackage(packageDir, candidate) {
  let resolvedDir;
  let resolvedFile;
  try {
    resolvedDir = await realpath(packageDir);
    resolvedFile = await realpath(candidate);
  } catch {
    return false;
  }
  // Normalize to ensure we do prefix matching with a trailing separator
  // (so /a/b is not considered inside /a/b-other).
  const boundary = resolvedDir.endsWith(sep) ? resolvedDir : resolvedDir + sep;
  return (resolvedFile + sep).startsWith(boundary);
}

/**
 * Normalize a relative skill path to forward-slash form for display.
 *
 * @param {string} p
 */
export function toPosix(p) {
  return p.split(sep).join(posixPath.sep);
}
