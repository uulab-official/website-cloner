#!/usr/bin/env node
import { readFile, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { captureBrowserOptions } from './lib/browser-check.mjs';
import { parseOptions, httpUrl, positiveInteger, ratio, safeError } from './lib/cli.mjs';
import { prepareOutputDirectory, writeJson } from './lib/output.mjs';
import { normalizeActions } from './lib/action-contract.mjs';
import { assessPair, renderReport } from './lib/verification.mjs';

const scripts = path.dirname(fileURLToPath(import.meta.url));
const help = `Usage: node scripts/verify.mjs --source URL --target URL --out DIR [options]

Capture both live URLs, check matching conditions, compare each viewport, and
write verification.json plus a script-free index.html with local PNG evidence.

  --widths LIST              Unique widths (default 1440,768,390; at most 10)
  --height NUMBER            Viewport height (default 900; dimensions 1..8192)
  --scheme light|dark        Preferred scheme (default light)
  --state LABEL              Shared state label (default default)
  --source-actions FILE      Source click/scroll/assert JSON, using source selectors
  --target-actions FILE      Target click/scroll/assert JSON, using target selectors
  --keep-scroll              Preserve scroll after actions on both pages
  --browser NAME             chromium (default), firefox or webkit for BOTH sides
  --executable-path FILE     Explicit Chromium executable for both captures (Chromium only)
  --max-diff-ratio NUMBER    Optional pixel threshold 0..1; no default pass gate
  --overwrite               Replace only a prior verify-owned output directory
  --help                     Show help

Only run against pages you own or are authorized to inspect. Do not specify
submit/purchase actions. No TLS bypass, saved authentication, or source bundle
copying. URLs and page diagnostics are recorded: do not use secret-bearing URLs.
Static screenshots do not establish functional parity or physical-device parity.
Full-page PNGs are retained for inspection; comparisons use equal-size viewports.
Exit 1 for failed captures, incompatible conditions, invalid comparisons, or an
explicitly exceeded threshold. Warnings require review even with exit 0.
`;

function execute(filename, args, timeout) {
  const result = spawnSync(process.execPath, [path.join(scripts, filename), ...args], {
    encoding: 'utf8', timeout, maxBuffer: 1_000_000, windowsHide: true, killSignal: 'SIGKILL',
  });
  return { exitCode: result.status, signal: result.signal, error: result.error ? safeError(result.error) : null,
    stdout: (result.stdout || '').slice(-12000), stderr: (result.stderr || '').slice(-12000) };
}
async function readJson(filename) {
  try { return JSON.parse(await readFile(filename, 'utf8')); } catch { return null; }
}
async function main(argv) {
  const options = parseOptions(argv, {
    values: ['source', 'target', 'out', 'widths', 'height', 'scheme', 'state', 'source-actions', 'target-actions', 'executable-path', 'max-diff-ratio', 'browser'],
    booleans: ['keep-scroll', 'overwrite'], required: ['source', 'target', 'out'],
  });
  if (options.help) { process.stdout.write(help); return; }
  const selected = captureBrowserOptions({ browser: options.browser, executablePath: options['executable-path'] });
  const sourceUrl = httpUrl(options.source); const targetUrl = httpUrl(options.target);
  const widths = (options.widths || '1440,768,390').split(',').map(value => positiveInteger(value.trim(), '--widths'));
  if (widths.length > 10 || new Set(widths).size !== widths.length) throw new Error('--widths must contain at most 10 unique widths');
  const height = positiveInteger(options.height || '900', '--height');
  const scheme = options.scheme || 'light';
  if (!['light', 'dark'].includes(scheme)) throw new Error('--scheme must be light or dark');
  const state = options.state || 'default';
  if (state.length > 120 || /[\u0000-\u001f\u007f]/.test(state)) throw new Error('--state must be a label of at most 120 characters without control characters');
  const maxDiffRatio = options['max-diff-ratio'] === undefined ? null : ratio(options['max-diff-ratio'], '--max-diff-ratio');
  const protectedPaths = ['source-actions', 'target-actions', 'executable-path'].filter(key => options[key]).map(key => path.resolve(options[key]));
  for (const key of ['source-actions', 'target-actions']) {
    if (!options[key]) continue;
    const metadata = await stat(options[key]);
    if (!metadata.isFile() || metadata.size > 100000) throw new Error(`--${key} must be a JSON file smaller than 100 KB`);
    normalizeActions(JSON.parse(await readFile(options[key], 'utf8')));
  }
  const out = await prepareOutputDirectory(options.out, { overwrite: options.overwrite, tool: 'verify', protectedPaths });
  const report = { schemaVersion: 1, tool: 'website-cloner/verify', createdAt: new Date().toISOString(), status: 'running',
    browser: selected.name, sourceUrl, targetUrl, state, widths, height, scheme, maxDiffRatio, functionalParity: 'not_verified', motionVerified: false,
    note: 'Live URL capture. Static screenshots and pixel differences are evidence, not a semantic fidelity score. No functional parity claim.',
    commands: {}, errors: [], rows: [] };
  await writeJson(path.join(out, 'verification.json'), report);
  try {
    const shared = ['--browser', selected.name, '--widths', widths.join(','), '--height', String(height), '--scheme', scheme, '--state', state];
    if (options['keep-scroll']) shared.push('--keep-scroll');
    if (options['executable-path']) shared.push('--executable-path', path.resolve(options['executable-path']));
    for (const [side, url] of [['source', sourceUrl], ['target', targetUrl]]) {
      const args = ['--url', url, '--out', path.join(out, side), ...shared];
      if (options[`${side}-actions`]) args.push('--actions', path.resolve(options[`${side}-actions`]));
      process.stdout.write(`Capturing ${side} at ${widths.join(', ')}px\n`);
      report.commands[side] = execute('capture.mjs', args, 120000 * widths.length + 30000);
      if (report.commands[side].exitCode !== 0 || report.commands[side].error) report.errors.push(`${side} capture process failed; inspect commands and capture.json`);
      await writeJson(path.join(out, 'verification.json'), report);
    }
    for (const width of widths) {
      const folder = `${width}x${height}`;
      const source = await readJson(path.join(out, 'source', folder, 'page.json'));
      const target = await readJson(path.join(out, 'target', folder, 'page.json'));
      let comparison = null; let command = null;
      if (assessPair(source, target, null, maxDiffRatio, selected.name).comparable) {
        const args = ['--source', path.join(out, 'source', folder, 'viewport.png'), '--target', path.join(out, 'target', folder, 'viewport.png'), '--out', path.join(out, 'comparisons', folder)];
        if (maxDiffRatio !== null) args.push('--max-diff-ratio', String(maxDiffRatio));
        command = execute('compare.mjs', args, 60000);
        comparison = await readJson(path.join(out, 'comparisons', folder, 'report.json'));
      }
      const row = { width, height, ...assessPair(source, target, comparison, maxDiffRatio, selected.name),
        sourceCaptured: source?.status === 'completed', targetCaptured: target?.status === 'completed',
        hasComparison: ['compared', 'threshold_exceeded'].includes(comparison?.status), command };
      if (command && (command.error || command.exitCode !== 0)) {
        row.status = 'failed'; row.errors.push('Comparison process failed; inspect command and report.json');
      }
      report.rows.push(row);
      process.stdout.write(`${folder}: ${row.status}; changed pixels=${row.changedPixelRatio ?? 'not measured'}; visual gate=${row.visualGate}\n`);
    }
    report.status = report.errors.length || report.rows.some(row => row.status !== 'completed') ? 'failed' : 'completed';
  } catch (error) { report.status = 'failed'; report.errors.push(safeError(error)); }
  finally {
    report.completedAt = new Date().toISOString();
    await writeJson(path.join(out, 'verification.json'), report);
    await writeFile(path.join(out, 'index.html'), renderReport(report));
  }
  process.stdout.write(`Report: ${path.join(out, 'index.html')}\n`);
  if (report.status !== 'completed') process.exitCode = 1;
}
main(process.argv.slice(2)).catch(error => { process.stderr.write(`verify: ${safeError(error)}\nUse --help for usage.\n`); process.exitCode = 1; });
