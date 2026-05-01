import { test, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { rm, mkdir, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { isAbsoluteUnsafe, hasTraversal, isWithinPackage } from '../src/pathSafety.js';
import { makeTmp } from './_helpers.js';

test('isAbsoluteUnsafe accepts relative paths', () => {
  assert.equal(isAbsoluteUnsafe('SKILL.md'), false);
  assert.equal(isAbsoluteUnsafe('skills/SKILL.md'), false);
  assert.equal(isAbsoluteUnsafe('./SKILL.md'), false);
});

test('isAbsoluteUnsafe rejects unix absolute', () => {
  assert.equal(isAbsoluteUnsafe('/etc/passwd'), true);
});

test('isAbsoluteUnsafe rejects windows absolute', () => {
  assert.equal(isAbsoluteUnsafe('C:\\foo'), true);
  assert.equal(isAbsoluteUnsafe('C:/foo'), true);
});

test('isAbsoluteUnsafe rejects backslash root', () => {
  assert.equal(isAbsoluteUnsafe('\\foo'), true);
});

test('hasTraversal rejects ..', () => {
  assert.equal(hasTraversal('../escape'), true);
  assert.equal(hasTraversal('a/../b'), true);
  assert.equal(hasTraversal('a\\..\\b'), true);
});

test('hasTraversal accepts segments containing dots but not exactly ..', () => {
  assert.equal(hasTraversal('foo..bar'), false);
  assert.equal(hasTraversal('a/b.c/d'), false);
  assert.equal(hasTraversal('SKILL.md'), false);
});

test('isWithinPackage: file inside package', async () => {
  const root = makeTmp('asc-within-');
  after(() => rm(root, { recursive: true, force: true }));

  const pkg = join(root, 'pkg');
  await mkdir(pkg, { recursive: true });
  const file = join(pkg, 'SKILL.md');
  await writeFile(file, 'x');

  assert.equal(await isWithinPackage(pkg, file), true);
});

test('isWithinPackage: symlink escape rejected', async () => {
  const root = makeTmp('asc-escape-');
  after(() => rm(root, { recursive: true, force: true }));

  const outside = join(root, 'outside.md');
  await writeFile(outside, 'sensitive');

  const pkg = join(root, 'pkg');
  await mkdir(pkg, { recursive: true });
  const link = join(pkg, 'SKILL.md');
  await symlink(outside, link);

  assert.equal(await isWithinPackage(pkg, link), false);
});

test('isWithinPackage: prefix collision (sibling dir) rejected', async () => {
  const root = makeTmp('asc-prefix-');
  after(() => rm(root, { recursive: true, force: true }));

  const pkg = join(root, 'pkg');
  const sibling = join(root, 'pkg-other');
  await mkdir(pkg, { recursive: true });
  await mkdir(sibling, { recursive: true });
  const file = join(sibling, 'SKILL.md');
  await writeFile(file, 'x');

  assert.equal(await isWithinPackage(pkg, file), false);
});

test('isWithinPackage: missing file fails closed', async () => {
  const root = makeTmp('asc-missing-');
  after(() => rm(root, { recursive: true, force: true }));

  const pkg = join(root, 'pkg');
  await mkdir(pkg, { recursive: true });
  assert.equal(await isWithinPackage(pkg, join(pkg, 'nope.md')), false);
});
