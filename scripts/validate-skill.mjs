import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('skills/website-clone');
const problems = [];
const markdown = await readFile(path.join(root, 'SKILL.md'), 'utf8');
const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
if (!frontmatter) problems.push('SKILL.md requires YAML frontmatter');
const name = frontmatter?.[1].match(/^name:\s*([a-z0-9-]+)\s*$/m)?.[1];
const description = frontmatter?.[1].match(/^description:\s*(.+)$/m)?.[1];
if (name !== 'website-clone') problems.push('Skill name must be website-clone');
if (!description || description.length > 1024) problems.push('Description must be nonempty and at most 1024 characters');
if (markdown.split('\n').length > 500) problems.push('Move long guidance into references');
if (/\bTODO\b|\[INSERT\b|\[PLACEHOLDER\b/.test(markdown)) problems.push('Remove unfinished scaffold markers');

for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
  const link = match[1].split('#')[0];
  if (!link || /^[a-z][a-z0-9+.-]*:/i.test(link)) continue;
  const target = path.resolve(root, link);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    problems.push(`Reference leaves the standalone skill: ${link}`);
    continue;
  }
  try { if (!(await stat(target)).isFile()) problems.push(`Reference is not a file: ${link}`); }
  catch { problems.push(`Missing reference: ${link}`); }
}
const metadata = await readFile(path.join(root, 'agents/openai.yaml'), 'utf8');
if (!metadata.includes('$website-clone')) problems.push('Default prompt must mention $website-clone');
const attribution = await readFile(path.join(root, 'references/upstream.md'), 'utf8');
if (!attribution.includes('Copyright (c) 2025 JCodesMore') || !attribution.includes('Permission is hereby granted')) {
  problems.push('Preserve the upstream copyright and MIT terms');
}
if (problems.length) {
  for (const problem of problems) process.stderr.write(`${problem}\n`);
  process.exitCode = 1;
} else process.stdout.write('website-clone: metadata, standalone references, and attribution verified.\n');
