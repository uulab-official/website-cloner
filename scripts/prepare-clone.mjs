#!/usr/bin/env node
import { parseOptions, safeError } from './lib/cli.mjs';
import { prepareProject } from './lib/prepare-project.mjs';
const help = `Usage: npm run prepare:clone -- --source URL --target URL --out NEW_DIRECTORY [options]

Explicitly initialize, capture the authorized SOURCE, observe it and prepare an
implementation handoff. Does not generate a clone, visit the target, run an app,
download reusable assets, approve rights or mark implementation as verified.

  --source URL          Authorized HTTP(S) source; no credentials or fragment
  --target URL          Planned implementation route; server need not be running
  --out DIR             NEW workspace only; no overwrite, delete or resume
  --widths LIST         Unique widths (default 1440,768,390; maximum 10)
  --height NUMBER       Viewport height (default 900); dimensions 1..8192
  --browser NAME        chromium (default), firefox or webkit
  --executable-path P   Alternative Chromium executable, not other engines
  --timeout-ms NUMBER   Capture process deadline, 1000..900000 (default 300000)
  --dry-run             Offline preflight only: no files, browser or requests
  --help                Offline help without installed browser dependencies

Start with index.html and START-HERE.md. preparation.json journals each stage.
Partial failures remain for diagnosis and exit nonzero. Logs are bounded tails.
Default light state only; no interaction actions. Source page code still runs.
Review queries, captures and logs for secrets before sharing. Not a sandbox.
This command is intentionally NOT npm's automatic prepare lifecycle hook.
`;
try {
  const o = parseOptions(process.argv.slice(2), { values: ['source', 'target', 'out', 'widths', 'height', 'browser', 'executable-path', 'timeout-ms'], booleans: ['dry-run'], required: ['source', 'target', 'out'] });
  if (o.help) process.stdout.write(help);
  else {
    const result = await prepareProject({ source: o.source, target: o.target, out: o.out, widths: o.widths, height: o.height, browser: o.browser, executablePath: o['executable-path'], timeoutMs: o['timeout-ms'], dryRun: o['dry-run'] || false });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); if (result.status === 'failed') process.exitCode = 1;
  }
} catch (error) { process.stderr.write(`prepare:clone: ${safeError(error)}\n`); process.exitCode = 1; }
