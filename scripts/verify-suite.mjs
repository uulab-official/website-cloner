#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseOptions, safeError } from './lib/cli.mjs';
import { prepareOutputDirectory, writeJson } from './lib/output.mjs';
import { normalizeSuite, verifyArguments, assessSuiteCase, summarizeSuite, renderSuiteReport } from './lib/suite.mjs';

const help = `Usage: node scripts/verify-suite.mjs --config FILE --out DIR [options]

Run named route/state pairs through the existing paired verification CLI.
Continue after failures and retain a local HTML index, suite.json and all evidence.

  --config FILE             JSON manifest (schemaVersion 1), at most 1 MB
  --out DIR                 New/empty output, or prior suite-owned run
  --only IDS                Comma-separated case IDs; unknown/duplicate IDs fail
  --source-origin URL       Override source origin, preserving paths/query/hash
  --target-origin URL       Override target origin, preserving paths/query/hash
  --fail-on-warnings        Treat captured diagnostic warnings as failures
  --executable-path FILE    Explicit Chromium executable for both sides
  --dry-run                 Validate and print plan; no output/browser/network work
  --overwrite               Replace only a prior verify-suite-owned output
  --help                    Show help

No visual gate is implied: maxDiffRatio defaults to null, not a pass threshold.
Static screenshots do not prove functional, animation or physical-device parity.
Only use authorized pages and click/scroll actions; never submit forms or purchases.
This is a trusted local developer tool, not an isolated public URL capture service.
Redirects/subresources are not origin-restricted. URLs and diagnostics are recorded;
do not use secrets or private session data. Inline actions use each side's selectors.
Normal CI uses local fixtures; live source captures remain opt-in.
`;
const scripts = path.dirname(fileURLToPath(import.meta.url));

async function readJsonFile(filename, maxBytes, description) {
  const metadata = await stat(filename);
  if (!metadata.isFile() || metadata.size > maxBytes) throw new Error(`${description} must be a regular JSON file no larger than ${maxBytes === 1000000 ? '1 MB' : '2 MB'}`);
  return JSON.parse(await readFile(filename, 'utf8'));
}
async function save(out, report) {
  report.summary = summarizeSuite(report.cases);
  await writeJson(path.join(out, 'suite.json'), report);
  await writeFile(path.join(out, 'index.html'), renderSuiteReport(report));
}
async function main(argv) {
  const options = parseOptions(argv, {
    values: ['config', 'out', 'only', 'source-origin', 'target-origin', 'executable-path'],
    booleans: ['dry-run', 'overwrite', 'fail-on-warnings'], required: ['config'],
  });
  if (options.help) { process.stdout.write(help); return; }
  const config = path.resolve(options.config);
  const suite = normalizeSuite(await readJsonFile(config, 1000000, 'Manifest'), {
    sourceOrigin: options['source-origin'], targetOrigin: options['target-origin'],
    only: options.only === undefined ? undefined : options.only.split(',').map(id => id.trim()),
  });
  if (options['dry-run']) { process.stdout.write(`${JSON.stringify(suite, null, 2)}\n`); return; }
  if (!options.out) throw new Error('--out is required unless --dry-run is used');
  const executablePath = options['executable-path'] ? path.resolve(options['executable-path']) : null;
  if (executablePath && !(await stat(executablePath)).isFile()) throw new Error('--executable-path must be a regular file');
  const out = await prepareOutputDirectory(options.out, { overwrite: options.overwrite, tool: 'verify-suite',
    protectedPaths: [config, ...(executablePath ? [executablePath] : [])] });
  const report = { schemaVersion: 1, tool: 'website-cloner/verify-suite', name: suite.name,
    createdAt: new Date().toISOString(), status: 'running', functionalParity: 'not_verified', motionVerified: false,
    failOnWarnings: Boolean(options['fail-on-warnings']), excluded: suite.excluded,
    plan: suite.cases, cases: suite.cases.map(item => ({ id: item.id, state: item.state, source: item.source,
      target: item.target, status: 'pending', errors: [], warnings: [], rows: [] })) };
  await save(out, report);
  for (const [index, item] of suite.cases.entries()) {
    const startedAt = new Date().toISOString();
    let result; let command = null;
    process.stdout.write(`[${index + 1}/${suite.cases.length}] ${item.id}\n`);
    try {
      const directory = path.join(out, 'cases', item.id);
      await mkdir(directory, { recursive: true });
      for (const side of ['source', 'target']) {
        if (item[`${side}Actions`].length) await writeJson(path.join(directory, `${side}-actions.json`), item[`${side}Actions`]);
      }
      // verify.mjs already bounds each capture/comparison. Avoid an outer timeout
      // that could kill only the coordinator while leaving its Chromium child alive.
      const child = spawnSync(process.execPath, [path.join(scripts, 'verify.mjs'), ...verifyArguments(item, directory, executablePath)], {
        encoding: 'utf8', maxBuffer: 1000000, windowsHide: true,
      });
      command = { exitCode: child.status, signal: child.signal, error: child.error ? safeError(child.error) : null,
        stdout: (child.stdout || '').slice(-12000), stderr: (child.stderr || '').slice(-12000) };
      let verification = null; let readError = null;
      try { verification = await readJsonFile(path.join(directory, 'evidence', 'verification.json'), 2000000, 'Child report'); }
      catch (error) { readError = safeError(error); }
      result = assessSuiteCase(item, command, verification, report.failOnWarnings);
      if (readError) result.errors.push(`Cannot read paired evidence: ${readError}`);
    } catch (error) {
      result = { id: item.id, state: item.state, source: item.source, target: item.target, status: 'failed',
        functionalParity: 'not_verified', rows: [], warnings: [], errors: [safeError(error)] };
    }
    report.cases[index] = { ...result, startedAt, completedAt: new Date().toISOString(), command };
    await save(out, report);
    process.stdout.write(`${item.id}: ${result.status}; warnings=${result.warnings.length}\n`);
  }
  report.status = report.cases.every(item => item.status === 'completed') ? 'completed' : 'failed';
  report.completedAt = new Date().toISOString();
  await save(out, report);
  process.stdout.write(`Suite report: ${path.join(out, 'index.html')}\n`);
  if (report.status !== 'completed') process.exitCode = 1;
}
main(process.argv.slice(2)).catch(error => {
  process.stderr.write(`verify-suite: ${safeError(error)}\nUse --help for usage.\n`); process.exitCode = 1;
});
