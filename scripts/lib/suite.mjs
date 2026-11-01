import path from 'node:path';
import { httpUrl } from './cli.mjs';

const settingKeys = ['widths', 'height', 'scheme', 'keepScroll', 'maxDiffRatio'];
const defaults = { widths: [1440, 768, 390], height: 900, scheme: 'light', keepScroll: false, maxDiffRatio: null };
const gates = ['passed', 'failed', 'not_requested', 'not_evaluated'];
const validRatio = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string');
const validId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value)
  && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(value);

function object(value, allowed, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${name}: unknown field ${key}`);
}
function label(value, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > 120 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`${name} must be a nonempty label of at most 120 characters without control characters`);
  }
  if (name === 'state' && value.startsWith('--')) throw new Error('state must not begin with --');
  return value;
}
function settings(value) {
  const result = { ...value };
  const dimension = item => typeof item === 'number' && Number.isInteger(item) && item >= 1 && item <= 8192;
  if (!Array.isArray(value.widths) || !value.widths.length || value.widths.length > 10
    || !value.widths.every(dimension) || new Set(value.widths).size !== value.widths.length) {
    throw new Error('widths must contain 1..10 unique integer dimensions from 1 to 8192');
  }
  if (!dimension(value.height)) throw new Error('height must be an integer from 1 to 8192');
  if (!['light', 'dark'].includes(value.scheme)) throw new Error('scheme must be light or dark');
  if (typeof value.keepScroll !== 'boolean') throw new Error('keepScroll must be a boolean');
  if (value.maxDiffRatio !== null && !validRatio(value.maxDiffRatio)) throw new Error('maxDiffRatio must be null or a number from 0 to 1');
  result.widths = [...value.widths];
  return result;
}
function actions(value, name) {
  if (!Array.isArray(value) || value.length > 50) throw new Error(`${name} must be an array of at most 50 actions`);
  if (Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`) > 100000) throw new Error(`${name} exceeds the capture limit of 100 KB`);
  return value.map((action, index) => {
    object(action, ['type', 'selector'], `${name}[${index}]`);
    if (!['click', 'scroll'].includes(action.type) || typeof action.selector !== 'string'
      || !action.selector.trim() || action.selector.length > 2000 || action.selector.includes('\0')) {
      throw new Error(`${name}[${index}] requires click/scroll and a nonempty selector of at most 2000 characters`);
    }
    return { type: action.type, selector: action.selector };
  });
}
function url(value) {
  if (typeof value !== 'string' || value.length > 8000 || value !== value.trim() || /[\u0000-\u0020\u007f]/.test(value)) {
    throw new Error('URLs must be HTTP(S) strings without whitespace or control characters, at most 8000 characters');
  }
  return httpUrl(value);
}
function origin(value) {
  if (value === undefined) return null;
  const parsed = new URL(url(value));
  if (parsed.href !== `${parsed.origin}/`) throw new Error('Origin override must not contain a path, query or fragment');
  return parsed.origin;
}
function remap(value, replacement) {
  const parsed = new URL(url(value));
  return replacement ? `${replacement}${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.href;
}

/** Validate the entire manifest before selection or destructive output preparation. */
export function normalizeSuite(input, overrides = {}) {
  object(input, ['schemaVersion', 'name', 'defaults', 'cases'], 'suite');
  if (input.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
  const name = label(input.name, 'name');
  if (!Array.isArray(input.cases) || input.cases.length < 1 || input.cases.length > 20) throw new Error('cases must contain 1..20 entries');
  const inputDefaults = input.defaults === undefined ? {} : input.defaults;
  object(inputDefaults, settingKeys, 'defaults');
  const shared = settings({ ...defaults, ...inputDefaults });
  const sourceOrigin = origin(overrides.sourceOrigin); const targetOrigin = origin(overrides.targetOrigin);
  const ids = new Set();
  const cases = input.cases.map(entry => {
    object(entry, ['id', 'source', 'target', 'state', 'sourceActions', 'targetActions', ...settingKeys], 'case');
    if (!validId(entry.id)) throw new Error('Case id must be a safe lowercase slug (1..64 characters), not a reserved device name');
    if (ids.has(entry.id)) throw new Error(`Duplicate case id: ${entry.id}`);
    ids.add(entry.id);
    const overrides = Object.fromEntries(settingKeys.filter(key => Object.hasOwn(entry, key)).map(key => [key, entry[key]]));
    return { id: entry.id, source: remap(entry.source, sourceOrigin), target: remap(entry.target, targetOrigin),
      ...settings({ ...shared, ...overrides }), state: label(entry.state === undefined ? entry.id : entry.state, 'state'),
      sourceActions: actions(entry.sourceActions === undefined ? [] : entry.sourceActions, 'sourceActions'),
      targetActions: actions(entry.targetActions === undefined ? [] : entry.targetActions, 'targetActions') };
  });
  if (cases.reduce((sum, item) => sum + item.widths.length, 0) > 60) throw new Error('A suite may contain at most 60 viewport pairs');
  const only = overrides.only;
  if (only !== undefined) {
    if (!Array.isArray(only) || !only.length || !only.every(id => typeof id === 'string') || new Set(only).size !== only.length) {
      throw new Error('Selected case IDs must be a nonempty unique array');
    }
    for (const id of only) if (!ids.has(id)) throw new Error(`Unknown case: ${id}`);
  }
  return { schemaVersion: 1, name, cases: cases.filter(item => !only || only.includes(item.id)),
    excluded: cases.filter(item => only && !only.includes(item.id)).map(item => item.id) };
}

/** Explicit argv, never shell interpolation. Inline action files live outside verify-owned output. */
export function verifyArguments(item, directory, executablePath) {
  const args = ['--source', item.source, '--target', item.target, '--out', path.join(directory, 'evidence'),
    '--widths', item.widths.join(','), '--height', String(item.height), '--scheme', item.scheme, '--state', item.state];
  for (const side of ['source', 'target']) if (item[`${side}Actions`].length) args.push(`--${side}-actions`, path.join(directory, `${side}-actions.json`));
  if (item.keepScroll) args.push('--keep-scroll');
  if (item.maxDiffRatio !== null) args.push('--max-diff-ratio', String(item.maxDiffRatio));
  if (executablePath) args.push('--executable-path', executablePath);
  return args;
}

/** Reconcile child exit, report identity, every requested viewport and explicit gates. */
export function assessSuiteCase(item, command, report, failOnWarnings = false) {
  const errors = []; const warnings = []; const rows = [];
  if (command?.exitCode !== 0 || command?.signal || command?.error) errors.push('Verification process failed; inspect command diagnostics');
  if (!report || report.schemaVersion !== 1 || report.tool !== 'website-cloner/verify' || report.status !== 'completed') errors.push('Verification report missing, invalid or not completed');
  for (const [key, expected] of Object.entries({ sourceUrl: item.source, targetUrl: item.target, height: item.height,
    scheme: item.scheme, state: item.state, maxDiffRatio: item.maxDiffRatio })) {
    if (report?.[key] !== expected) errors.push(`Report condition mismatch: ${key}`);
  }
  if (!Array.isArray(report?.widths) || JSON.stringify(report.widths) !== JSON.stringify(item.widths)) errors.push('Report widths do not match requested widths');
  if (!strings(report?.errors)) errors.push('Invalid or missing report errors');
  else errors.push(...report.errors);
  const supplied = Array.isArray(report?.rows) ? report.rows : [];
  if (supplied.length !== item.widths.length) errors.push('Missing or extra viewport rows');
  for (const width of item.widths) {
    const matches = supplied.filter(row => row?.width === width);
    const row = matches.length === 1 ? matches[0] : null;
    const rowErrors = [];
    if (!row || row.height !== item.height) rowErrors.push('Missing, duplicate or mismatched viewport row');
    const rowWarnings = strings(row?.warnings) ? row.warnings : [];
    if (!strings(row?.warnings) || !strings(row?.errors)) rowErrors.push('Invalid viewport diagnostics');
    if (strings(row?.errors)) rowErrors.push(...row.errors);
    const measured = row?.comparable === true && row?.hasComparison === true && validRatio(row?.changedPixelRatio);
    const visualGate = item.maxDiffRatio === null ? 'not_requested'
      : measured ? (row.changedPixelRatio <= item.maxDiffRatio ? 'passed' : 'failed') : 'not_evaluated';
    if (row?.status !== 'completed' || !measured || row.sourceCaptured !== true || row.targetCaptured !== true) rowErrors.push('Viewport verification not completed');
    if (row?.visualGate !== visualGate) rowErrors.push('Inconsistent visual threshold result');
    if (visualGate === 'failed') rowErrors.push('Explicit pixel threshold exceeded');
    errors.push(...rowErrors.map(error => `${width}x${item.height}: ${error}`));
    warnings.push(...rowWarnings.map(warning => `${width}x${item.height}: ${warning}`));
    rows.push({ width, height: item.height, status: rowErrors.length ? 'failed' : 'completed', visualGate,
      changedPixelRatio: measured ? row.changedPixelRatio : null, errors: rowErrors, warnings: rowWarnings });
  }
  if (failOnWarnings && warnings.length) errors.push(`Strict diagnostics: ${warnings.length} warnings`);
  return { id: item.id, source: item.source, target: item.target, state: item.state, maxDiffRatio: item.maxDiffRatio,
    status: errors.length ? 'failed' : 'completed', functionalParity: 'not_verified', errors, warnings, rows };
}

export function summarizeSuite(cases) {
  const summary = { total: cases.length, completed: 0, failed: 0, pending: 0, warnings: 0,
    visualGates: Object.fromEntries(gates.map(gate => [gate, 0])) };
  for (const item of cases) {
    summary[['completed', 'failed'].includes(item.status) ? item.status : 'pending']++;
    summary.warnings += item.warnings?.length || 0;
    for (const row of item.rows || []) if (gates.includes(row.visualGate)) summary.visualGates[row.visualGate]++;
  }
  return summary;
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
/** Offline index: no scripts, no remote assets and no evidence-supplied hrefs. */
export function renderSuiteReport(report) {
  const summary = summarizeSuite(report.cases);
  const cases = report.cases.map(item => {
    const link = validId(item.id) ? `<a href="cases/${item.id}/evidence/index.html">View paired evidence</a>` : '';
    const notes = [...(item.errors || []), ...(item.warnings || [])].map(note => `<li>${escapeHtml(note)}</li>`).join('');
    const rows = (item.rows || []).map(row => `<tr><td>${escapeHtml(row.width)} × ${escapeHtml(row.height)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.visualGate)}</td><td>${validRatio(row.changedPixelRatio) ? `${(row.changedPixelRatio * 100).toFixed(4)}%` : 'not measured'}</td></tr>`).join('');
    return `<section><h2>${escapeHtml(item.id)} · ${escapeHtml(item.status)}</h2><p>State: ${escapeHtml(item.state)}<br>Source: ${escapeHtml(item.source)}<br>Implementation: ${escapeHtml(item.target)}</p><p>${link}</p>${notes ? `<ul>${notes}</ul>` : ''}<div class="scroll"><table><thead><tr><th>Viewport</th><th>Execution</th><th>Visual threshold</th><th>Changed pixels</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Website Cloner — verification suite</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:1200px;margin:auto;padding:32px}section{border-top:1px solid;padding:24px 0}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px;border-bottom:1px solid}p,li{overflow-wrap:anywhere}.scroll{overflow:auto}@media(max-width:600px){body{padding:16px}}</style><h1>${escapeHtml(report.name)}</h1><p>Execution: <strong>${escapeHtml(report.status)}</strong> · ${summary.completed}/${summary.total} completed · ${summary.failed} failed · ${summary.pending} pending · ${summary.warnings} warnings</p><p>Visual gates: ${gates.map(gate => `${gate}=${summary.visualGates[gate]}`).join(' · ')}</p><p>Functional parity: <strong>not_verified</strong>. Pixel differences are not a fidelity score. Static screenshots do not verify backend behavior, motion, physical devices or interaction correctness. Missing thresholds are not visual passes.</p><p>Excluded cases: ${(report.excluded || []).map(escapeHtml).join(', ') || 'none'}</p><p><a href="suite.json">Complete JSON evidence</a></p>${cases}</html>\n`;
}
