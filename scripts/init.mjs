#!/usr/bin/env node
import { parseOptions, safeError } from './lib/cli.mjs';
import { initializeProject } from './lib/project-init.mjs';

const help = `Usage: npm run init -- --source URL --target URL --out NEW_DIRECTORY [options]

Create an offline clone evidence/handoff bundle. This does not clone a website,
visit URLs, download assets, install dependencies or modify your application.

  --source URL      Authorized source page (HTTP/S; no credentials or fragments)
  --target URL      Planned implementation URL, including its destination path
  --out DIR         New directory only; existing and protected paths are rejected
  --widths LIST     Unique widths, 1..8192 (default: 1440,768,390; maximum 10)
  --height NUMBER   Viewport height, 1..8192 (default: 900)
  --dry-run         Validate and print the plan without creating any files
  --help            Show this help without browser installation

No --overwrite option. Query strings are stored: remove secrets before sharing.
Initialize does not establish asset rights or mark any verification as passed.
`;
try {
  const options = parseOptions(process.argv.slice(2), { values: ['source', 'target', 'out', 'widths', 'height'], booleans: ['dry-run'], required: ['source', 'target', 'out'] });
  if (options.help) process.stdout.write(help);
  else {
    const { 'dry-run': dryRun = false, ...input } = options;
    const result = await initializeProject({ ...input, dryRun });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
} catch (error) {
  process.stderr.write(`init: ${safeError(error)}\n`);
  process.exitCode = 1;
}
