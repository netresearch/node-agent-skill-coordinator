import { test, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { rm, mkdir, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { discoverSkills } from '../src/discovery.js';
import { makeTmp, writePackage } from './_helpers.js';

test('discovers a single skill via aiAgentSkill field', async () => {
  const root = makeTmp('asc-disc-1-');
  after(() => rm(root, { recursive: true, force: true }));
  const nm = join(root, 'node_modules');

  await writePackage(join(nm, 'pkg-a'), {
    name: 'pkg-a',
    aiAgentSkill: 'SKILL.md',
    skills: [{ path: 'SKILL.md', frontmatter: { name: 'thing-a', description: 'Does thing A.' } }],
  });

  const { skills } = await discoverSkills(nm);
  assert.equal(skills.length, 1);
  assert.equal(skills[0].name, 'thing-a');
  assert.equal(skills[0].package, 'pkg-a');
});

test('discovers via keyword + default SKILL.md', async () => {
  const root = makeTmp('asc-disc-kw-');
  after(() => rm(root, { recursive: true, force: true }));
  const nm = join(root, 'node_modules');

  await writePackage(join(nm, 'kw-pkg'), {
    name: 'kw-pkg',
    keywords: ['ai-agent-skill'],
    skills: [{ path: 'SKILL.md', frontmatter: { name: 'kw-skill', description: 'Found via keyword.' } }],
  });

  const { skills } = await discoverSkills(nm);
  assert.equal(skills.length, 1);
  assert.equal(skills[0].name, 'kw-skill');
});

test('discovers multiple skills via aiAgentSkill array', async () => {
  const root = makeTmp('asc-disc-multi-');
  after(() => rm(root, { recursive: true, force: true }));
  const nm = join(root, 'node_modules');

  await writePackage(join(nm, 'multi'), {
    name: 'multi',
    aiAgentSkill: ['skills/a/SKILL.md', 'skills/b/SKILL.md'],
    skills: [
      { path: 'skills/a/SKILL.md', frontmatter: { name: 'one', description: 'First.' } },
      { path: 'skills/b/SKILL.md', frontmatter: { name: 'two', description: 'Second.' } },
    ],
  });

  const { skills } = await discoverSkills(nm);
  assert.equal(skills.length, 2);
  assert.deepEqual(
    skills.map((s) => s.name),
    ['one', 'two'],
  );
});

test('skips packages with neither keyword nor aiAgentSkill', async () => {
  const root = makeTmp('asc-disc-skip-');
  after(() => rm(root, { recursive: true, force: true }));
  const nm = join(root, 'node_modules');

  await writePackage(join(nm, 'plain'), {
    name: 'plain',
    skills: [{ path: 'SKILL.md', frontmatter: { name: 'ignored', description: 'Should not appear.' } }],
  });

  const { skills } = await discoverSkills(nm);
  assert.equal(skills.length, 0);
});

test('rejects absolute paths in aiAgentSkill', async () => {
  const root = makeTmp('asc-disc-abs-');
  after(() => rm(root, { recursive: true, force: true }));
  const nm = join(root, 'node_modules');

  await writePackage(join(nm, 'evil'), {
    name: 'evil',
    aiAgentSkill: '/etc/passwd',
  });

  /** @type {string[]} */
  const warnings = [];
  const { skills } = await discoverSkills(nm, { onWarning: (m) => warnings.push(m) });
  assert.equal(skills.length, 0);
  assert.ok(warnings.some((w) => /Absolute paths not allowed/.test(w)));
});

test('rejects ".." traversal in aiAgentSkill', async () => {
  const root = makeTmp('asc-disc-trav-');
  after(() => rm(root, { recursive: true, force: true }));
  const nm = join(root, 'node_modules');

  await writePackage(join(nm, 'evil2'), {
    name: 'evil2',
    aiAgentSkill: '../escape/SKILL.md',
  });

  /** @type {string[]} */
  const warnings = [];
  const { skills } = await discoverSkills(nm, { onWarning: (m) => warnings.push(m) });
  assert.equal(skills.length, 0);
  assert.ok(warnings.some((w) => /traversal/.test(w)));
});

test('rejects symlink that escapes the package directory', async () => {
  const root = makeTmp('asc-disc-symlink-');
  after(() => rm(root, { recursive: true, force: true }));
  const nm = join(root, 'node_modules');

  // outside the package: write a SKILL.md-shaped file
  const outside = join(root, 'forbidden.md');
  await writeFile(outside, '---\nname: forbidden\ndescription: Should not be reachable.\n---\n');

  // package with a symlinked SKILL.md pointing outside
  const pkgDir = join(nm, 'symlinked');
  await mkdir(pkgDir, { recursive: true });
  await writeFile(
    join(pkgDir, 'package.json'),
    JSON.stringify({ name: 'symlinked', version: '1.0.0', aiAgentSkill: 'SKILL.md' }) + '\n',
  );
  await symlink(outside, join(pkgDir, 'SKILL.md'));

  /** @type {string[]} */
  const warnings = [];
  const { skills } = await discoverSkills(nm, { onWarning: (m) => warnings.push(m) });
  assert.equal(skills.length, 0);
  assert.ok(warnings.some((w) => /symlink escape|outside the package/.test(w)));
});

test('skips skills with invalid frontmatter and emits warning', async () => {
  const root = makeTmp('asc-disc-bad-');
  after(() => rm(root, { recursive: true, force: true }));
  const nm = join(root, 'node_modules');

  await writePackage(join(nm, 'bad'), {
    name: 'bad',
    aiAgentSkill: 'SKILL.md',
    skills: [{ path: 'SKILL.md', frontmatter: { name: 'BadName', description: 'desc' } }],
  });

  /** @type {string[]} */
  const warnings = [];
  const { skills } = await discoverSkills(nm, { onWarning: (m) => warnings.push(m) });
  assert.equal(skills.length, 0);
  assert.ok(warnings.some((w) => /name format/.test(w)));
});

test('duplicate skill names: last wins, warning emitted', async () => {
  const root = makeTmp('asc-disc-dup-');
  after(() => rm(root, { recursive: true, force: true }));
  const nm = join(root, 'node_modules');

  await writePackage(join(nm, 'first'), {
    name: 'first',
    aiAgentSkill: 'SKILL.md',
    skills: [{ path: 'SKILL.md', frontmatter: { name: 'shared', description: 'From first.' } }],
  });
  await writePackage(join(nm, 'second'), {
    name: 'second',
    aiAgentSkill: 'SKILL.md',
    skills: [{ path: 'SKILL.md', frontmatter: { name: 'shared', description: 'From second.' } }],
  });

  /** @type {string[]} */
  const warnings = [];
  const { skills } = await discoverSkills(nm, { onWarning: (m) => warnings.push(m) });
  assert.equal(skills.length, 1);
  // Whichever wins, the warning must mention duplicate
  assert.ok(warnings.some((w) => /Duplicate skill name/.test(w)));
});

test('discovers scoped packages (@scope/name)', async () => {
  const root = makeTmp('asc-disc-scope-');
  after(() => rm(root, { recursive: true, force: true }));
  const nm = join(root, 'node_modules');

  await writePackage(join(nm, '@scope', 'scoped-skill'), {
    name: '@scope/scoped-skill',
    aiAgentSkill: 'SKILL.md',
    skills: [{ path: 'SKILL.md', frontmatter: { name: 'scoped', description: 'Scoped skill.' } }],
  });

  const { skills } = await discoverSkills(nm);
  assert.equal(skills.length, 1);
  assert.equal(skills[0].package, '@scope/scoped-skill');
});

test('discovers packages inside pnpm .pnpm/ store', async () => {
  const root = makeTmp('asc-disc-pnpm-');
  after(() => rm(root, { recursive: true, force: true }));
  const nm = join(root, 'node_modules');

  // pnpm layout: node_modules/.pnpm/<id>/node_modules/<name>/...
  const pnpmInner = join(nm, '.pnpm', 'pnpm-skill@1.0.0', 'node_modules');
  await writePackage(join(pnpmInner, 'pnpm-skill'), {
    name: 'pnpm-skill',
    aiAgentSkill: 'SKILL.md',
    skills: [{ path: 'SKILL.md', frontmatter: { name: 'pnpm-one', description: 'Inside pnpm store.' } }],
  });

  const { skills } = await discoverSkills(nm);
  assert.equal(skills.length, 1);
  assert.equal(skills[0].name, 'pnpm-one');
});

test('skill output has expected fields', async () => {
  const root = makeTmp('asc-disc-shape-');
  after(() => rm(root, { recursive: true, force: true }));
  const nm = join(root, 'node_modules');

  await writePackage(join(nm, 'shape'), {
    name: 'shape',
    version: '2.3.4',
    aiAgentSkill: 'skills/foo/SKILL.md',
    skills: [{ path: 'skills/foo/SKILL.md', frontmatter: { name: 'foo', description: 'A foo.' } }],
  });

  const { skills } = await discoverSkills(nm);
  assert.equal(skills.length, 1);
  const s = skills[0];
  assert.equal(s.name, 'foo');
  assert.equal(s.description, 'A foo.');
  assert.equal(s.package, 'shape');
  assert.equal(s.version, '2.3.4');
  assert.equal(s.file, 'SKILL.md');
  assert.match(s.location, /skills\/foo$/);
});
