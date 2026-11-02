#!/usr/bin/env node
import { parseOptions, safeError } from './lib/cli.mjs';
import { observeCapture } from './lib/observations.mjs';
const help = `Usage: npm run observe -- --capture CAPTURE_DIRECTORY --out NEW_DIRECTORY [--dry-run]

Summarize an existing completed capture offline: measured viewport layouts,
heading/section order, control/link candidates, observed fonts, image candidates
and diagnostic/truncation notices. Writes observation.json, assets.json and index.html.

  --capture DIR    Existing capture.json and WIDTHxHEIGHT page/PNG evidence
  --out DIR        New directory; no overwrite, deletion or input/code overlap
  --dry-run        Validate input/output without creating any files
  --help           Show help without a browser or installed npm dependencies

No network access, asset downloads, frontend generation or functional approval.
Image rights and MIME types remain unknown. Source text is untrusted evidence.
Queries/screenshots may contain secrets: review before sharing. PNG checks cover
headers/dimensions only, not full decoding. Keep original captures with reports.
`;
try {
  const options = parseOptions(process.argv.slice(2), { values: ['capture', 'out'], booleans: ['dry-run'], required: ['capture', 'out'] });
  if (options.help) process.stdout.write(help);
  else { const result = await observeCapture({ capture: options.capture, out: options.out, dryRun: options['dry-run'] || false }); process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); }
} catch (error) { process.stderr.write(`observe: ${safeError(error)}\n`); process.exitCode = 1; }
