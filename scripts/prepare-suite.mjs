#!/usr/bin/env node
import { parseOptions, safeError } from './lib/cli.mjs';
import { prepareSuite } from './lib/prepare-suite.mjs';
const help = `Usage: npm run prepare:suite -- --manifest FILE --out NEW_DIRECTORY [options]

Prepare explicitly listed source pages/states sequentially using a schema-v1
verify:suite manifest. Does not crawl, generate an app, separately visit targets,
start servers, download reusable assets or approve visual/functional parity.

  --manifest FILE       Verification suite; all cases/actions validated first
  --out DIR             NEW directory only; no overwrite, deletion or resume
  --browser NAME        chromium (default), firefox or webkit
  --executable-path P   Alternative Chromium executable only
  --timeout-ms NUMBER   Per-case CAPTURE deadline 1000..900000 (default 300000)
  --fail-fast           Stop after first failed case; later cases are not_run
  --dry-run             Offline preflight: no files, browsers or network
  --help                Show this help without browser dependencies

All actions are snapshotted before capture; generated suite.json uses relative
paths and retains every case, threshold and future verifier timeoutMs. An explicit
empty source action array is required for target-only action overrides. Source
click/scroll actions must be non-destructive; never submit forms or purchases.
Partial failures are retained and exit nonzero; interruption stops queued work.
Read index.html and START-HERE.md. Prepared does NOT mean implemented or verified.
Source scripts may make their own requests. This is not a security sandbox.
`;
try {
  const o = parseOptions(process.argv.slice(2), { values: ['manifest', 'out', 'browser', 'executable-path', 'timeout-ms'], booleans: ['dry-run', 'fail-fast'], required: ['manifest', 'out'] });
  if (o.help) process.stdout.write(help);
  else {
    const result = await prepareSuite({ manifest: o.manifest, out: o.out, browser: o.browser, executablePath: o['executable-path'], timeoutMs: o['timeout-ms'], dryRun: o['dry-run'] || false, failFast: o['fail-fast'] || false });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); if (result.status === 'failed') process.exitCode = 1;
  }
} catch (error) { process.stderr.write(`prepare:suite: ${safeError(error)}\n`); process.exitCode = 1; }
