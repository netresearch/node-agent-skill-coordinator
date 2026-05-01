import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseFrontmatter } from '../src/parser.js';

test('parses simple key: value frontmatter', () => {
  const r = parseFrontmatter('---\nname: foo\ndescription: a thing\n---\n\nbody\n');
  assert.deepEqual(r, { frontmatter: { name: 'foo', description: 'a thing' } });
});

test('returns error when no frontmatter delimiters', () => {
  const r = parseFrontmatter('# Just markdown\n\nNo frontmatter here.\n');
  assert.ok('error' in r);
});

test('returns error when frontmatter is not closed', () => {
  const r = parseFrontmatter('---\nname: foo\n');
  assert.ok('error' in r);
});

test('handles double-quoted values with escapes', () => {
  const r = parseFrontmatter('---\nname: foo\ndescription: "has: a colon and \\"quote\\""\n---\n');
  assert.ok('frontmatter' in r);
  assert.equal(r.frontmatter.description, 'has: a colon and "quote"');
});

test('handles single-quoted values', () => {
  const r = parseFrontmatter("---\nname: foo\ndescription: 'has: a colon'\n---\n");
  assert.ok('frontmatter' in r);
  assert.equal(r.frontmatter.description, 'has: a colon');
});

test('strips inline comments outside quotes', () => {
  const r = parseFrontmatter('---\nname: foo  # this is a comment\ndescription: bar\n---\n');
  assert.ok('frontmatter' in r);
  assert.equal(r.frontmatter.name, 'foo');
});

test('does not strip # inside quoted strings', () => {
  const r = parseFrontmatter('---\nname: foo\ndescription: "hash # inside"\n---\n');
  assert.ok('frontmatter' in r);
  assert.equal(r.frontmatter.description, 'hash # inside');
});

test('rejects malformed line missing colon', () => {
  const r = parseFrontmatter('---\nname foo\n---\n');
  assert.ok('error' in r);
});

test('rejects invalid key', () => {
  const r = parseFrontmatter('---\n9bad: value\n---\n');
  assert.ok('error' in r);
});

test('handles CRLF line endings', () => {
  const r = parseFrontmatter('---\r\nname: foo\r\ndescription: bar\r\n---\r\n');
  assert.ok('frontmatter' in r);
  assert.equal(r.frontmatter.name, 'foo');
  assert.equal(r.frontmatter.description, 'bar');
});

test('skips blank lines in frontmatter body', () => {
  const r = parseFrontmatter('---\nname: foo\n\ndescription: bar\n---\n');
  assert.ok('frontmatter' in r);
  assert.equal(r.frontmatter.description, 'bar');
});
