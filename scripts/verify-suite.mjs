#!/usr/bin/env node
import path from 'node:path';
import { parseOptions, safeError } from './lib/cli.mjs';
import { loadSuite } from './lib/suite-config.mjs';
import { runSuite } from './lib/suite-runner.mjs';

const help = `Usage: node scripts/verify-suite.mjs --manifest FILE --out DIR [options]

Run an explicit list of authorized source/target routes and states using verify.mjs.
Write suite.json and a script-free index.html linking each paired capture report.

  --manifest FILE          Strict schemaVersion: 1 JSON manifest (required)
  --out DIR                New/empty output directory (required unless --dry-run)
  --source-origin URL      Override source origin, without credentials/path/query
  --target-origin URL      Override target origin, e.g. http://localhost:4173
  --executable-path FILE   Explicit Chromium executable for all cases
  --dry-run                Validate manifest/actions and print plan; no captures/writes
  --fail-fast              Stop after first failed case; remaining cases are skipped
  --overwrite              Replace only a prior verify-suite-owned output directory
  --help                   Show help

Action files resolve relative to the manifest, not your working directory.
Cases run sequentially; failures normally do not stop remaining cases. Exit 1
means invalid input, execution failure, incomplete evidence or a threshold failure.
Exit 0 means comparisons completed, NOT functional parity or visual approval.
No threshold is assumed; set maxDiffRatio per case/defaults only when appropriate.
Use only authorized pages and non-submitting observation actions. No JavaScript
or shell commands are accepted in the manifest. Reports may contain page text and
URLs: do not use secrets in URLs and review artifacts before publishing them.
`;
async function main(argv) {
  const options = parseOptions(argv, {
    values: ['manifest', 'out', 'source-origin', 'target-origin', 'executable-path'],
    booleans: ['dry-run', 'fail-fast', 'overwrite'], required: ['manifest'],
  });
  if (options.help) { process.stdout.write(help); return; }
  if (!options['dry-run'] && !options.out) throw new Error('Required option missing: --out');
  // Preflight EVERY referenced action before prepareOutputDirectory can replace output.
  const plan = await loadSuite(options.manifest, { sourceOrigin: options['source-origin'], targetOrigin: options['target-origin'] });
  if (options['dry-run']) { process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`); return; }
  const report = await runSuite(plan, { out: options.out, overwrite: options.overwrite, failFast: options['fail-fast'],
    executablePath: options['executable-path'], onProgress: message => process.stdout.write(`${message}\n`) });
  process.stdout.write(`Suite: ${report.status}; ${report.summary.completed} completed, ${report.summary.failed} failed, ${report.summary.skipped} skipped\nReport: ${path.resolve(options.out, 'index.html')}\n`);
  if (report.status !== 'completed') process.exitCode = 1;
}
main(process.argv.slice(2)).catch(error => { process.stderr.write(`verify-suite: ${safeError(error)}\nUse --help for usage.\n`); process.exitCode = 1; });
