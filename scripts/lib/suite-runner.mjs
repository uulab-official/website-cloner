import { spawn } from 'node:child_process';
import { lstat, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { safeError } from './cli.mjs';
import { captureBrowserOptions } from './browser-check.mjs';
import { validateExactPixels, formatPixelRatio, exactPixelSummary, zeroDifferenceWarning } from './exact-pixels.mjs';
import { prepareOutputDirectory } from './output.mjs';
import { buildVerifyArgs, validCaseId } from './suite-config.mjs';

const verifyScript = fileURLToPath(new URL('../verify.mjs', import.meta.url));
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string');
const successful = result => result && result.exitCode === 0 && !result.error && !result.signal && !result.timedOut && !result.interrupted;
const validRatio = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** Execute a fixed local Node script with literal arguments, bounded logs and a process-tree timeout. */
export function executeNodeScript(script, args, { timeoutMs, env = process.env, maxOutputChars = 12000 }) {
  return new Promise(resolve => {
    const record = { exitCode: null, signal: null, error: null, timedOut: false, stdout: '', stderr: '' };
    let child;
    try {
      child = spawn(process.execPath, [script, ...args], {
        env, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) { record.error = safeError(error); resolve(record); return; }
    for (const stream of ['stdout', 'stderr']) {
      child[stream].setEncoding('utf8');
      child[stream].on('data', chunk => { record[stream] = (record[stream] + chunk).slice(-maxOutputChars); });
    }
    const terminateTree = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') {
        // Node cannot directly signal a Windows process group. Never use a shell.
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
        killer.on('error', () => child.kill('SIGKILL'));
        killer.on('close', code => { if (code !== 0) child.kill('SIGKILL'); });
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      }
    };
    const interrupt = signal => {
      record.interrupted = true; record.error = `Interrupted by ${signal}`; terminateTree();
    };
    const onInterrupt = () => interrupt('SIGINT');
    const onTerminate = () => interrupt('SIGTERM');
    process.once('SIGINT', onInterrupt); process.once('SIGTERM', onTerminate);
    const timer = setTimeout(() => {
      record.timedOut = true; record.error = `Case timeout after ${timeoutMs} ms`; terminateTree();
    }, timeoutMs);
    child.once('error', error => { record.error = safeError(error); });
    child.once('close', (code, signal) => {
      clearTimeout(timer); process.removeListener('SIGINT', onInterrupt); process.removeListener('SIGTERM', onTerminate); record.exitCode = code; record.signal = signal; resolve(record);
    });
  });
}

/** Do not let a child exit code or a partial/stale report substitute for complete evidence. */
export function assessCase(report, item, command) {
  const result = { id: item.id, browser: item.browser ?? null, state: item.state, sourceUrl: item.sourceUrl, targetUrl: item.targetUrl,
    widths: item.widths, height: item.height, scheme: item.scheme, maxDiffRatio: item.maxDiffRatio,
    status: 'failed', visualGate: item.maxDiffRatio === null ? 'not_requested' : 'not_evaluated',
    functionalParity: 'not_verified', reviewRequired: false, errors: [], warnings: [], rows: [], command };
  if (!successful(command)) result.errors.push(command?.error || `Verifier process failed (exit=${command?.exitCode ?? 'none'}, signal=${command?.signal ?? 'none'})`);
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    result.errors.push('Verification report missing or invalid'); return result;
  }
  if (report.schemaVersion !== 1 || report.tool !== 'website-cloner/verify') result.errors.push('Unsupported verification report schema/tool');
  if (report.status !== 'completed') result.errors.push(`Verification did not complete: ${String(report.status)}`);
  for (const field of ['sourceUrl', 'targetUrl', 'state', 'scheme', 'height', 'maxDiffRatio']) {
    if (report[field] !== item[field]) result.errors.push(`Report does not match requested ${field}`);
  }
  if (item.browser !== undefined && report.browser !== item.browser) result.errors.push('Report does not match requested browser');
  if (JSON.stringify(report.widths) !== JSON.stringify(item.widths)) result.errors.push('Report does not match requested widths');
  if (!strings(report.errors)) result.errors.push('Invalid verification error list');
  else result.errors.push(...report.errors);
  for (const side of ['source', 'target']) if (!successful(report.commands?.[side])) result.errors.push(`${side} capture command did not succeed`);
  if (!Array.isArray(report.rows) || report.rows.length !== item.widths.length) result.errors.push('Missing or extra viewport result rows');
  const rows = Array.isArray(report.rows) ? report.rows : [];
  let thresholdExceeded = false;
  for (const width of item.widths) {
    const matches = rows.filter(row => row && row.width === width && row.height === item.height);
    if (matches.length !== 1) { result.errors.push(`Missing or duplicate result for ${width}x${item.height}`); continue; }
    const row = matches[0]; const label = `${width}x${item.height}`;
    if (item.browser !== undefined && (row.browser !== item.browser || typeof row.browserVersion !== 'string' || !row.browserVersion.trim())) result.errors.push(`${label}: missing or mismatched requested browser evidence`);
    if (row.status !== 'completed' || row.comparable !== true || row.sourceCaptured !== true || row.targetCaptured !== true || row.hasComparison !== true) result.errors.push(`${label}: incomplete capture or comparison`);
    if (!successful(row.command)) result.errors.push(`${label}: comparison command did not succeed`);
    if (!strings(row.errors) || !strings(row.warnings)) result.errors.push(`${label}: invalid diagnostics`);
    const errors = strings(row.errors) ? row.errors : [];
    const warnings = strings(row.warnings) ? row.warnings : [];
    result.errors.push(...errors.map(value => `${label}: ${value}`));
    result.warnings.push(...warnings.map(value => `${label}: ${value}`));
    const measured = validRatio(row.changedPixelRatio);
    if (!measured) result.errors.push(`${label}: missing or invalid changed-pixel ratio`);
    const gate = item.maxDiffRatio === null ? 'not_requested' : !measured ? 'not_evaluated' : row.changedPixelRatio <= item.maxDiffRatio ? 'passed' : 'failed';
    if (row.visualGate !== gate) result.errors.push(`${label}: inconsistent visual threshold result`);
    if (gate === 'failed') { thresholdExceeded = true; result.errors.push(`${label}: changed-pixel ratio exceeds requested threshold`); }
    let exactPixels = null;
    if (row.exactPixels !== undefined && row.exactPixels !== null) {
      try {
        exactPixels = validateExactPixels(row.exactPixels, width, item.height);
        if (row.changedPixelRatio === 0 && !exactPixels.identical) result.warnings.push(`${label}: ${zeroDifferenceWarning}`);
      } catch (error) { result.errors.push(`${label}: ${error.message}`); }
    }
    result.rows.push({ browser: row.browser ?? null, browserVersion: row.browserVersion ?? null, width, height: item.height, exactPixels, changedPixelRatio: measured ? row.changedPixelRatio : null,
      visualGate: gate, status: row.status === 'completed' ? 'completed' : 'failed', errors, warnings });
  }
  result.errors = [...new Set(result.errors)]; result.warnings = [...new Set(result.warnings)]; result.reviewRequired = result.warnings.length > 0;
  result.status = result.errors.length ? 'failed' : 'completed';
  if (item.maxDiffRatio !== null) result.visualGate = thresholdExceeded ? 'failed' : result.errors.length ? 'not_evaluated' : 'passed';
  return result;
}
function summarize(cases) {
  const counts = { total: cases.length, completed: 0, failed: 0, skipped: 0, pending: 0, reviewRequired: 0, visualPassed: 0, visualFailed: 0, visualNotRequested: 0, visualNotEvaluated: 0 };
  for (const item of cases) {
    if (Object.hasOwn(counts, item.status)) counts[item.status]++;
    if (item.reviewRequired) counts.reviewRequired++;
    const key = { passed: 'visualPassed', failed: 'visualFailed', not_requested: 'visualNotRequested', not_evaluated: 'visualNotEvaluated' }[item.visualGate];
    if (key) counts[key]++;
  }
  return counts;
}
async function readReport(filename) {
  const metadata = await stat(filename);
  if (!metadata.isFile() || metadata.size > 5000000) throw new Error('Verification report must be a regular file no larger than 5 MB');
  const content = await readFile(filename);
  if (content.length > 5000000) throw new Error('Verification report exceeds 5 MB');
  return JSON.parse(content.toString('utf8'));
}
async function missingArtifacts(out, item, report) {
  const expected = ['index.html'];
  for (const width of item.widths) {
    const folder = `${width}x${item.height}`;
    for (const side of ['source', 'target']) {
      for (const name of ['page.json', 'viewport.png', 'full-page.png']) expected.push(`${side}/${folder}/${name}`);
    }
    for (const name of ['report.json', 'diff.png', 'side-by-side.png']) expected.push(`comparisons/${folder}/${name}`);
    if (report.rows?.some(row => row?.width === width && row?.exactPixels != null)) expected.push(`comparisons/${folder}/exact-diff.png`);
  }
  const errors = [];
  for (const relative of expected) {
    try {
      const metadata = await lstat(path.join(out, relative));
      if (!metadata.isFile() || metadata.size === 0) throw new Error('not a nonempty regular file');
    } catch { errors.push(`Missing, empty or unsafe evidence artifact: ${relative}`); }
  }
  return errors;
}
async function persist(out, report) {
  report.summary = summarize(report.cases);
  // A process interruption must not truncate the most recently completed summary.
  for (const [filename, text] of [['suite.json', `${JSON.stringify(report, null, 2)}\n`], ['index.html', renderSuiteReport(report)]]) {
    const destination = path.join(out, filename); const temporary = `${destination}.tmp`;
    await writeFile(temporary, text); await rename(temporary, destination);
  }
}

/** execute is a test seam only; the CLI cannot configure an executable script. */
export async function runSuite(plan, { out: requestedOut, overwrite = false, failFast = false, executablePath, browser,
  execute = ({ item, args }) => executeNodeScript(verifyScript, args, { timeoutMs: item.timeoutMs }), onProgress = () => {} } = {}) {
  const selected = captureBrowserOptions({ browser, executablePath });
  const cases = plan.cases.map(item => ({ ...item, browser: selected.name }));
  const executable = executablePath ? path.resolve(executablePath) : undefined;
  if (executable && !(await stat(executable)).isFile()) throw new Error('Chromium executable must be a regular file');
  const out = await prepareOutputDirectory(requestedOut, { overwrite, tool: 'verify-suite', protectedPaths: [...plan.protectedPaths, ...(executable ? [executable] : [])] });
  const report = { schemaVersion: 1, tool: 'website-cloner/verify-suite', createdAt: new Date().toISOString(), status: 'running',
    browser: selected.name, sourceOrigin: plan.sourceOrigin, targetOrigin: plan.targetOrigin, failFast, functionalParity: 'not_verified', motionVerified: false,
    note: 'Execution status is not a fidelity score or a functional test pass. Open each case to inspect screenshots and diagnostics.',
    errors: [], cases: cases.map(item => ({ id: item.id, browser: item.browser, state: item.state, status: 'pending',
      visualGate: item.maxDiffRatio === null ? 'not_requested' : 'not_evaluated', errors: [], warnings: [], reviewRequired: false, reportAvailable: false })) };
  await mkdir(path.join(out, 'cases')); await persist(out, report);
  let failed = false; let interrupted = false;
  try {
    for (const [index, item] of cases.entries()) {
      if ((failFast && failed) || interrupted) {
        report.cases[index].status = 'skipped'; report.cases[index].errors = [interrupted ? 'Not executed because the suite was interrupted' : 'Not executed because --fail-fast stopped after an earlier failure'];
        continue;
      }
      onProgress(`Running ${index + 1}/${plan.cases.length}: ${item.id}`);
      const caseOut = path.join(out, 'cases', item.id); const args = buildVerifyArgs(item, caseOut, executable);
      const startedAt = new Date().toISOString(); let command; let childReport = null; let reportError = null;
      try { command = await execute({ item, out: caseOut, args }); }
      catch (error) { command = { exitCode: null, signal: null, timedOut: false, error: safeError(error), stdout: '', stderr: '' }; }
      try { childReport = await readReport(path.join(caseOut, 'verification.json')); }
      catch (error) { reportError = `Could not read verification.json: ${safeError(error)}`; }
      const result = assessCase(childReport, item, command);
      if (reportError) result.errors.push(reportError);
      if (childReport) result.errors.push(...await missingArtifacts(caseOut, item, result));
      if (result.errors.length) {
        result.status = 'failed';
        if (result.visualGate === 'passed') result.visualGate = 'not_evaluated';
      }
      interrupted ||= Boolean(command?.interrupted);
      let reportAvailable = false;
      try { reportAvailable = (await stat(path.join(caseOut, 'index.html'))).isFile(); } catch { /* no clickable report */ }
      report.cases[index] = { ...result, startedAt, completedAt: new Date().toISOString(), reportAvailable };
      failed ||= result.status === 'failed'; await persist(out, report);
      onProgress(`${item.id}: ${result.status}; visual gate=${result.visualGate}`);
    }
    report.status = failed || report.cases.some(item => item.status !== 'completed') ? 'failed' : 'completed';
  } catch (error) {
    report.status = 'failed'; report.errors.push(safeError(error));
    for (const item of report.cases) if (item.status === 'pending') { item.status = 'skipped'; item.errors.push('Suite interrupted before this case ran'); }
  } finally {
    report.completedAt = new Date().toISOString(); await persist(out, report);
  }
  return report;
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export function renderSuiteReport(report) {
  const list = values => (Array.isArray(values) ? values : []).map(value => `<li>${escapeHtml(value)}</li>`).join('');
  const rows = (report.cases || []).map(item => {
    const link = item.reportAvailable && validCaseId(item.id) ? `<a href="cases/${item.id}/index.html">${escapeHtml(item.id)}</a>` : escapeHtml(item.id);
    const notes = list([...(item.errors || []), ...(item.warnings || [])]);
    const measurements = (item.rows || []).map(row => `<p>${escapeHtml(row.width)} × ${escapeHtml(row.height)}: Tolerance-filtered ${escapeHtml(formatPixelRatio(row.changedPixelRatio))}<br>${escapeHtml(exactPixelSummary(row.exactPixels, row.width, row.height))}</p>`).join('');
    return `<tr><th scope="row">${link}</th><td>${escapeHtml(item.state)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.visualGate)}</td><td>${measurements}${notes ? `<ul>${notes}</ul>` : '—'}</td></tr>`;
  }).join('\n');
  const summary = Object.entries(report.summary || {}).map(([name, count]) => `${escapeHtml(name)}: ${escapeHtml(count)}`).join(' · ');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Website Cloner — verification suite</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:1200px;margin:auto;padding:28px}h1{line-height:1.2}table{border-collapse:collapse;width:100%}td,th{border:1px solid;padding:12px;text-align:left;vertical-align:top}p,td,th,li{overflow-wrap:anywhere}.table{overflow-x:auto}ul{padding-left:20px}@media(max-width:600px){body{padding:16px}td,th{padding:8px}}</style><h1>Verification suite</h1><p>Execution: <strong>${escapeHtml(report.status)}</strong></p><p>Browser: ${escapeHtml(report.browser ?? 'not recorded')}</p><p>Source: ${escapeHtml(report.sourceOrigin)}<br>Target: ${escapeHtml(report.targetOrigin)}</p><p>${summary}</p><p>${escapeHtml(report.note)}</p><p>Functional parity: <strong>not_verified</strong>. Completed means the comparison ran, not that the clone is correct. “not_requested” means no visual threshold was set; “not_evaluated” means a requested threshold could not be reliably evaluated. Warnings require review. Tolerant zero does not mean identical; Exact RGBA counts all decoded channel differences (including alpha/invisible RGB), not PNG file bytes or visual quality. Static screenshots do not verify motion, physical devices, backend behavior or all interactions.</p><p><a href="suite.json">Complete suite JSON</a></p>${report.errors?.length ? `<ul>${list(report.errors)}</ul>` : ''}<div class="table"><table><thead><tr><th>Case</th><th>State</th><th>Execution</th><th>Visual threshold</th><th>Diagnostics</th></tr></thead><tbody>${rows}</tbody></table></div></html>\n`;
}
