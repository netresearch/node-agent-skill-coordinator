// Public programmatic API. CLI commands and the postinstall hook are
// intentionally thin wrappers around these — keep this surface stable.

export { discoverSkills } from './discovery.js';
export { generateSkillsXml, updateAgentsMd } from './generator.js';
export { iterPackages, declaresSkills } from './scanner.js';
export { parseFrontmatter } from './parser.js';
export { validateFrontmatter } from './validator.js';
