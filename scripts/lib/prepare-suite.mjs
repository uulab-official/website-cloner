import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { normalizeSuite } from './suite-config.mjs';
import { initializeProject } from './project-init.mjs';
import { planPreparationState } from './preparation-state.mjs';
import { prepareProject } from './prepare-project.mjs';
import { captureBrowserOptions } from './browser-check.mjs';
import { positiveInteger, safeError } from './cli.mjs';
import { preparationSuiteHtml, suiteStartHere } from './preparation-suite-report.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const route = value => { const u = new URL(value); return u.pathname + u.search; };
const jsonText = value => `${JSON.stringify(value, null, 2)}\n`;
async function bytes(filename, limit) {
  const s = await lstat(filename);
  if (!s.isFile() || s.isSymbolicLink() || s.size < 1 || s.size > limit) throw new Error(`Input must be a regular nonempty file no larger than ${limit} bytes`);
  const data = await readFile(filename);
  if (data.length > limit) throw new Error('Input exceeds size limit');
  return data;
}
function summarize(cases) {
  const count = status => cases.filter(c => c.status === status).length;
  return { total: cases.length, prepared: count('prepared'), failed: count('failed'), notRun: count('not_run'), running: count('running'),
    plannedViews: cases.reduce((n, c) => n + c.widths.length, 0), preparedViews: cases.filter(c => c.status === 'prepared').reduce((n, c) => n + c.summary.views, 0) };
}
async function persist(out, record) {
  record.summary = summarize(record.cases);
  for (const [name, content] of [['preparation-suite.json', jsonText(record)], ['index.html', preparationSuiteHtml(record)]]) {
    const dest = path.join(out, name), temp = `${dest}.next`;
    await writeFile(temp, content, { flag: 'wx' }); await rename(temp, dest);
  }
}
async function checkSnapshots(out, snapshots) {
  for (const s of snapshots) if (hash(await bytes(path.join(out, s.path), 100000)) !== s.sha256) throw new Error('Batch action snapshot changed after preflight');
}

/** Explicit sources only. execute is the existing capture test seam, never a CLI option. */
export async function prepareSuite({ manifest, out, browser = 'chromium', executablePath, timeoutMs = 300000, failFast = false, dryRun = false } = {}, { execute } = {}) {
  if (typeof failFast !== 'boolean' || typeof dryRun !== 'boolean') throw new Error('failFast and dryRun must be boolean');
  if (typeof manifest !== 'string' || !manifest.trim() || manifest.length > 8192 || /[\u0000-\u001f\u007f]/.test(manifest)) throw new Error('manifest must be a nonempty file path');
  const timeout = positiveInteger(timeoutMs, 'timeout-ms', 900000);
  if (timeout < 1000) throw new Error('timeout-ms must be from 1000 to 900000');
  const selected = captureBrowserOptions({ browser, executablePath });
  if (executablePath && !(await lstat(path.resolve(executablePath))).isFile()) throw new Error('Chromium executable must be a regular file');
  const filename = path.resolve(manifest), input = await bytes(filename, 1000000);
  let raw; try { raw = JSON.parse(input); } catch { throw new Error('Suite manifest must contain valid JSON'); }
  const plan = normalizeSuite(raw, { manifestPath: filename });
  const first = plan.cases[0];
  // Reuse init's new-directory, canonical-parent and toolkit-code protections.
  const { destination } = await initializeProject({ source: first.sourceUrl, target: first.targetUrl, out, dryRun: true });
  const snapshots = [], prepared = [];
  const suite = { schemaVersion: 1, sourceOrigin: plan.sourceOrigin, targetOrigin: plan.targetOrigin, cases: [] };
  // Read and canonicalize ALL actions before the first write or source visit.
  for (const item of plan.cases) {
    const state = await planPreparationState({ state: item.state, scheme: item.scheme, keepScroll: item.keepScroll, actions: item.sourceActions, targetActions: item.targetActions });
    const snapshotPath = s => s ? `actions/${item.id}/${path.posix.basename(s.path)}` : undefined;
    const sourceActions = snapshotPath(state.source), targetActions = snapshotPath(state.target);
    for (const s of state.snapshots) snapshots.push({ ...s, path: snapshotPath(s) });
    const entry = { id: item.id, path: route(item.sourceUrl), targetPath: route(item.targetUrl), widths: item.widths, height: item.height,
      state: item.state, scheme: item.scheme, keepScroll: item.keepScroll, maxDiffRatio: item.maxDiffRatio, timeoutMs: item.timeoutMs };
    if (sourceActions) Object.assign(entry, { sourceActions, targetActions });
    suite.cases.push(entry);
    prepared.push({ item, state, sourceActions, targetActions });
  }
  normalizeSuite(suite, { manifestPath: path.join(destination, 'suite.json') });
  const record = { schemaVersion: 1, tool: 'website-cloner/prepare-suite', status: 'planned', createdAt: new Date().toISOString(), finishedAt: null,
    destination, browser: selected.name, sourceOrigin: plan.sourceOrigin, targetOrigin: plan.targetOrigin, timeoutMs: timeout, failFast,
    inputManifestSha256: hash(input), manifest: 'suite.json', manifestSha256: hash(jsonText(suite)), networkAccess: false, targetVisited: false, interrupted: false,
    implementation: 'not_started', functionalParity: 'not_verified', visualComparison: 'not_performed', reviewRequired: true,
    actionSnapshots: snapshots.map(({ path, sha256, count }) => ({ path, sha256, count })),
    cases: plan.cases.map(c => ({ id: c.id, state: c.state, scheme: c.scheme, widths: c.widths, height: c.height, status: 'not_run', report: null, error: null, summary: null })), summary: null };
  record.summary = summarize(record.cases);
  if (dryRun) return record;
  await mkdir(path.dirname(destination), { recursive: true }); await mkdir(destination);
  await mkdir(path.join(destination, 'cases'));
  await writeFile(path.join(destination, 'suite.json'), jsonText(suite), { flag: 'wx' });
  await writeFile(path.join(destination, 'START-HERE.md'), suiteStartHere, { flag: 'wx' });
  for (const s of snapshots) { const file = path.join(destination, s.path); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, s.content, { flag: 'wx' }); }
  record.status = 'running'; await persist(destination, record);
  let stopped = false;
  for (const [index, p] of prepared.entries()) {
    const result = record.cases[index];
    if (stopped) { result.error = record.interrupted ? 'Not run after interruption' : 'Not run after fail-fast'; continue; }
    result.status = 'running'; await persist(destination, record);
    try {
      if (hash(await bytes(path.join(destination, 'suite.json'), 1000000)) !== record.manifestSha256) throw new Error('Batch manifest changed after preflight');
      const ownSnapshots = snapshots.filter(s => s.path.startsWith(`actions/${p.item.id}/`));
      await checkSnapshots(destination, ownSnapshots);
      const caseOut = path.join(destination, 'cases', p.item.id);
      const sourceActions = p.sourceActions && path.join(destination, p.sourceActions);
      const targetActions = p.targetActions && path.join(destination, p.targetActions);
      // networkAccess denotes permission to start capture, not a count of requests.
      record.networkAccess = true; await persist(destination, record);
      const child = await prepareProject({ source: p.item.sourceUrl, target: p.item.targetUrl, out: caseOut, widths: p.item.widths.join(','), height: p.item.height,
        state: p.item.state, scheme: p.item.scheme, keepScroll: p.item.keepScroll, actions: sourceActions,
        targetActions: targetActions !== sourceActions ? targetActions : undefined, browser: selected.name, executablePath, timeoutMs: timeout }, { execute });
      record.interrupted ||= Boolean(child.captureCommand?.interrupted);
      result.report = `cases/${p.item.id}/index.html`;
      await checkSnapshots(destination, ownSnapshots);
      if (child.status !== 'prepared') throw new Error(child.stages.find(s => s.status === 'failed')?.error || 'Case preparation did not complete');
      if (child.captureState.sourceActions?.sha256 !== p.state.source?.sha256 || child.captureState.targetActions?.sha256 !== p.state.target?.sha256) throw new Error('Prepared action evidence differs from preflight');
      result.status = 'prepared'; result.summary = child.summary;
    } catch (error) { result.status = 'failed'; result.error = safeError(error).slice(-12000); }
    stopped = record.interrupted || (failFast && result.status === 'failed');
    await persist(destination, record);
  }
  // Detect even a completed case's snapshot being changed while a later one ran.
  try {
    await checkSnapshots(destination, snapshots);
    if (hash(await bytes(path.join(destination, 'suite.json'), 1000000)) !== record.manifestSha256) throw new Error('Batch manifest changed after preflight');
  } catch (error) {
    record.integrityError = safeError(error).slice(-12000);
  }
  record.status = !record.integrityError && record.cases.every(c => c.status === 'prepared') ? 'prepared' : 'failed';
  record.finishedAt = new Date().toISOString(); await persist(destination, record); return record;
}
