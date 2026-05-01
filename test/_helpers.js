// Tiny fixture helper: build a temporary fake `node_modules` tree on disk
// for end-to-end discovery/scanner tests. Each helper returns the tmpdir
// path; callers should rm it in t.after().

import { mkdir, writeFile, symlink } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function makeTmp(prefix = 'asc-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * Create a package directory with a package.json and (optionally) a SKILL.md.
 *
 * @param {string} dir absolute package directory
 * @param {{
 *   name: string,
 *   version?: string,
 *   aiAgentSkill?: string | string[],
 *   keywords?: string[],
 *   skills?: Array<{ path: string, frontmatter: Record<string, string>, body?: string }>,
 * }} opts
 */
export async function writePackage(dir, opts) {
  await mkdir(dir, { recursive: true });

  /** @type {Record<string, unknown>} */
  const pj = {
    name: opts.name,
    version: opts.version ?? '1.0.0',
  };
  if (opts.aiAgentSkill !== undefined) pj.aiAgentSkill = opts.aiAgentSkill;
  if (opts.keywords !== undefined) pj.keywords = opts.keywords;

  await writeFile(join(dir, 'package.json'), JSON.stringify(pj, null, 2) + '\n');

  for (const s of opts.skills ?? []) {
    const fp = join(dir, s.path);
    await mkdir(join(fp, '..'), { recursive: true });
    let content = '---\n';
    for (const [k, v] of Object.entries(s.frontmatter)) content += `${k}: ${v}\n`;
    content += '---\n\n';
    content += s.body ?? '# Body\n';
    await writeFile(fp, content);
  }
}

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

export async function makeSymlink(target, link) {
  await symlink(target, link);
}
