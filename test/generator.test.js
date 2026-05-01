import { test, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generateSkillsXml, updateAgentsMd } from '../src/generator.js';
import { makeTmp } from './_helpers.js';

const skill = (name, description, location = '/abs/loc') => ({
  name,
  description,
  location,
  package: `pkg/${name}`,
  version: '1.0.0',
  file: 'SKILL.md',
});

test('generateSkillsXml: empty list still emits structure', () => {
  const xml = generateSkillsXml([]);
  assert.match(xml, /<skills_system priority="1">/);
  assert.match(xml, /<\/skills_system>$/);
  assert.match(xml, /<available_skills>/);
  assert.match(xml, /<!-- SKILLS_TABLE_START -->/);
  assert.match(xml, /<!-- SKILLS_TABLE_END -->/);
  assert.doesNotMatch(xml, /<skill>/);
});

test('generateSkillsXml: lists skills sorted by name', () => {
  const xml = generateSkillsXml([skill('b-second', 'second'), skill('a-first', 'first')]);
  const aIdx = xml.indexOf('<name>a-first</name>');
  const bIdx = xml.indexOf('<name>b-second</name>');
  assert.ok(aIdx > 0 && bIdx > aIdx);
});

test('generateSkillsXml: escapes XML special chars', () => {
  const xml = generateSkillsXml([skill('foo', 'Quotes "and\'s" & angle <brackets>')]);
  assert.match(xml, /Quotes &quot;and&apos;s&quot; &amp; angle &lt;brackets&gt;/);
});

test('generateSkillsXml: includes npx agent-skills read in usage', () => {
  const xml = generateSkillsXml([]);
  assert.match(xml, /npx agent-skills read/);
});

test('updateAgentsMd: creates file when absent', async () => {
  const root = makeTmp('asc-gen-create-');
  after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'AGENTS.md');

  await updateAgentsMd(path, [skill('a', 'A skill')]);
  const content = await readFile(path, 'utf8');
  assert.match(content, /<skills_system/);
  assert.match(content, /<name>a<\/name>/);
});

test('updateAgentsMd: replaces existing skills_system block, preserves rest', async () => {
  const root = makeTmp('asc-gen-replace-');
  after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'AGENTS.md');

  const initial = [
    '# AGENTS.md',
    '',
    'Project conventions go here.',
    '',
    '<skills_system priority="1">',
    '  <available_skills>',
    '    <skill><name>old</name><description>old</description><location>/x</location></skill>',
    '  </available_skills>',
    '</skills_system>',
    '',
    '## Footer',
    'Some unrelated trailing content.',
    '',
  ].join('\n');
  await writeFile(path, initial);

  await updateAgentsMd(path, [skill('new', 'New skill')]);
  const after_ = await readFile(path, 'utf8');

  assert.match(after_, /^# AGENTS\.md/);
  assert.match(after_, /Project conventions go here\./);
  assert.match(after_, /## Footer/);
  assert.match(after_, /<name>new<\/name>/);
  assert.doesNotMatch(after_, /<name>old<\/name>/);
});

test('updateAgentsMd: appends block when no existing block', async () => {
  const root = makeTmp('asc-gen-append-');
  after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'AGENTS.md');

  const initial = '# Existing\n\nProject docs.\n';
  await writeFile(path, initial);

  await updateAgentsMd(path, [skill('a', 'A')]);
  const after_ = await readFile(path, 'utf8');
  assert.match(after_, /^# Existing/);
  assert.match(after_, /Project docs\./);
  assert.match(after_, /<skills_system/);
});
