import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { validateFrontmatter } from '../src/validator.js';

test('accepts a valid skill', () => {
  assert.equal(validateFrontmatter({ name: 'my-skill', description: 'A useful skill.' }), null);
});

test('rejects missing name', () => {
  const err = validateFrontmatter({ description: 'foo' });
  assert.match(err ?? '', /name/);
});

test('rejects missing description', () => {
  const err = validateFrontmatter({ name: 'foo' });
  assert.match(err ?? '', /description/);
});

test('rejects empty name', () => {
  const err = validateFrontmatter({ name: '   ', description: 'desc' });
  assert.match(err ?? '', /name/);
});

test('rejects uppercase in name', () => {
  const err = validateFrontmatter({ name: 'MySkill', description: 'desc' });
  assert.match(err ?? '', /name format/);
});

test('rejects underscore in name', () => {
  const err = validateFrontmatter({ name: 'my_skill', description: 'desc' });
  assert.match(err ?? '', /name format/);
});

test('rejects name longer than 64 chars', () => {
  const err = validateFrontmatter({ name: 'a'.repeat(65), description: 'desc' });
  assert.match(err ?? '', /name format/);
});

test('accepts name at exactly 64 chars', () => {
  assert.equal(validateFrontmatter({ name: 'a'.repeat(64), description: 'desc' }), null);
});

test('rejects description longer than 1024 chars', () => {
  const err = validateFrontmatter({ name: 'foo', description: 'x'.repeat(1025) });
  assert.match(err ?? '', /1024/);
});

test('rejects description containing newline', () => {
  const err = validateFrontmatter({ name: 'foo', description: 'line1\nline2' });
  assert.match(err ?? '', /control characters/);
});

test('rejects description containing tab', () => {
  const err = validateFrontmatter({ name: 'foo', description: 'a\tb' });
  assert.match(err ?? '', /control characters/);
});

test('rejects description containing DEL', () => {
  const err = validateFrontmatter({ name: 'foo', description: 'a\x7fb' });
  assert.match(err ?? '', /control characters/);
});

test('rejects description with bidi-override codepoint', () => {
  const err = validateFrontmatter({ name: 'foo', description: 'safe‮text' });
  assert.match(err ?? '', /bidi/);
});

test('accepts description with non-ASCII letters', () => {
  assert.equal(validateFrontmatter({ name: 'foo', description: 'Schöne Grüße — café' }), null);
});
