// Minimal YAML-frontmatter parser for SKILL.md files.
//
// The skill spec is intentionally narrow: a `---`-delimited block at the
// top of the file containing flat `key: value` pairs. Strings may be
// optionally wrapped in single or double quotes. No nesting, no anchors,
// no flow-style. If a real-world skill ever needs richer YAML, swap in
// js-yaml — but zero deps is preferable on the postinstall hot path.

const FRONTMATTER_RE = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/;

/**
 * Extract and parse YAML frontmatter from a SKILL.md file's contents.
 *
 * @param {string} contents
 * @returns {{ frontmatter: Record<string, string> } | { error: string }}
 */
export function parseFrontmatter(contents) {
  const match = contents.match(FRONTMATTER_RE);
  if (!match) {
    return { error: 'No YAML frontmatter found.' };
  }

  const body = match[1];
  /** @type {Record<string, string>} */
  const result = {};

  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = stripComment(raw);
    if (line.trim() === '') continue;

    const colon = line.indexOf(':');
    if (colon === -1) {
      return { error: `Malformed frontmatter line ${i + 1}: missing ':'` };
    }

    const key = line.slice(0, colon).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key)) {
      return { error: `Invalid frontmatter key on line ${i + 1}: '${key}'` };
    }

    const valueRaw = line.slice(colon + 1).trim();
    const value = unquote(valueRaw);
    if (value === null) {
      return { error: `Malformed quoted value on line ${i + 1}` };
    }

    result[key] = value;
  }

  return { frontmatter: result };
}

/**
 * Strip a `#`-comment from a line, but only when `#` is not inside a
 * quoted string. Conservative: we treat the line as a single quoted run
 * if the first non-whitespace char after `:` is a quote.
 *
 * @param {string} line
 */
function stripComment(line) {
  // Find first `#` not inside quotes
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === '#' && !inSingle && !inDouble) {
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * Unwrap a YAML scalar string value. Supports plain (no quotes), single,
 * and double quotes. Returns null if quoting is malformed.
 *
 * @param {string} raw
 * @returns {string | null}
 */
function unquote(raw) {
  if (raw.length === 0) return '';
  const first = raw[0];
  if (first === '"' || first === "'") {
    if (raw.length < 2 || raw[raw.length - 1] !== first) return null;
    const inner = raw.slice(1, -1);
    if (first === '"') {
      return inner
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
    return inner.replace(/''/g, "'");
  }
  return raw;
}
