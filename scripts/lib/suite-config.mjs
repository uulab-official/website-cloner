import { normalizeActions } from './action-contract.mjs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const rootKeys = ['schemaVersion', 'sourceOrigin', 'targetOrigin', 'defaults', 'cases'];
const optionKeys = ['widths', 'height', 'scheme', 'state', 'keepScroll', 'maxDiffRatio', 'timeoutMs'];
const caseKeys = ['id', 'path', 'targetPath', 'sourceActions', 'targetActions', ...optionKeys];
const controls = /[\u0000-\u001f\u007f]/;
const reservedId = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
export const validCaseId = value => typeof value === 'string'
  && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value) && !reservedId.test(value);

function object(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`${name}: unknown field ${key}`);
}
function integer(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return value;
}
function label(value, name, limit = 120) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || controls.test(value)) {
    throw new Error(`${name} must be a nonempty string of at most ${limit} characters without control characters`);
  }
  return value;
}
function origin(value, name) {
  label(value, name, 4096);
  if (value.trim() !== value || value.includes('\\') || value.includes('?') || value.includes('#')) throw new Error(`${name} must be a plain HTTP(S) origin`);
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a valid HTTP(S) origin`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/') {
    throw new Error(`${name} must be an HTTP(S) origin without credentials or a path`);
  }
  return url.origin;
}
function route(value, base, name) {
  label(value, name, 4096);
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { throw new Error(`${name} has invalid path encoding`); }
  if (!value.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\') || controls.test(decoded)
    || value.includes('#') || decoded.split('?')[0].split('/').some(segment => ['.', '..'].includes(segment))) {
    throw new Error(`${name} must be a same-origin absolute path without traversal, backslashes or fragments`);
  }
  const url = new URL(value, base);
  if (url.origin !== base) throw new Error(`${name} must stay on the configured origin`);
  return url.href;
}
function options(value, name) {
  object(value, optionKeys, name);
  if (Object.hasOwn(value, 'widths')) {
    if (!Array.isArray(value.widths) || value.widths.length < 1 || value.widths.length > 10) throw new Error(`${name}.widths must contain 1..10 widths`);
    value.widths.forEach(width => integer(width, 1, 8192, `${name}.widths`));
    if (new Set(value.widths).size !== value.widths.length) throw new Error(`${name}.widths must be unique`);
  }
  if (Object.hasOwn(value, 'height')) integer(value.height, 1, 8192, `${name}.height`);
  if (Object.hasOwn(value, 'scheme') && !['light', 'dark'].includes(value.scheme)) throw new Error(`${name}.scheme must be light or dark`);
  if (Object.hasOwn(value, 'state')) label(value.state, `${name}.state`);
  if (Object.hasOwn(value, 'keepScroll') && typeof value.keepScroll !== 'boolean') throw new Error(`${name}.keepScroll must be boolean`);
  if (Object.hasOwn(value, 'maxDiffRatio') && value.maxDiffRatio !== null
    && (typeof value.maxDiffRatio !== 'number' || !Number.isFinite(value.maxDiffRatio) || value.maxDiffRatio < 0 || value.maxDiffRatio > 1)) {
    throw new Error(`${name}.maxDiffRatio must be null or a number from 0 to 1`);
  }
  if (Object.hasOwn(value, 'timeoutMs')) integer(value.timeoutMs, 1000, 3600000, `${name}.timeoutMs`);
}

/** Pure validation: no network, filesystem writes, or configuration-supplied code. */
export function normalizeSuite(input, { manifestPath, sourceOrigin, targetOrigin } = {}) {
  object(input, rootKeys, 'suite');
  if (input.schemaVersion !== 1) throw new Error('suite.schemaVersion must be 1');
  const source = origin(sourceOrigin ?? input.sourceOrigin, 'sourceOrigin');
  const target = origin(targetOrigin ?? input.targetOrigin, 'targetOrigin');
  const filename = path.resolve(label(manifestPath, 'manifestPath', 8192));
  const defaults = Object.hasOwn(input, 'defaults') ? input.defaults : {}; options(defaults, 'defaults');
  if (!Array.isArray(input.cases) || input.cases.length < 1 || input.cases.length > 50) throw new Error('cases must contain 1..50 case objects');
  const seen = new Set(); const protectedPaths = new Set([filename]);
  const cases = input.cases.map((entry, index) => {
    const name = `cases[${index}]`; object(entry, caseKeys, name);
    if (!validCaseId(entry.id)) throw new Error(`${name}.id must be a portable 1..64 character identifier (not a reserved filename)`);
    if (seen.has(entry.id.toLowerCase())) throw new Error(`${name}.id duplicates an earlier case (case-insensitive)`);
    seen.add(entry.id.toLowerCase());
    const overrides = Object.fromEntries(optionKeys.filter(key => Object.hasOwn(entry, key)).map(key => [key, entry[key]]));
    options(overrides, name);
    const merged = { widths: [1440, 768, 390], height: 900, scheme: 'light', state: 'default', keepScroll: false, maxDiffRatio: null, ...defaults, ...overrides };
    const result = { id: entry.id, ...merged, widths: [...merged.widths],
      sourceUrl: route(entry.path, source, `${name}.path`),
      targetUrl: route(Object.hasOwn(entry, 'targetPath') ? entry.targetPath : entry.path, target, `${name}.targetPath`),
      timeoutMs: merged.timeoutMs ?? 300000 * merged.widths.length + 90000,
    };
    for (const key of ['sourceActions', 'targetActions']) {
      if (!Object.hasOwn(entry, key)) continue;
      const absolute = path.resolve(path.dirname(filename), label(entry[key], `${name}.${key}`, 8192));
      result[key] = absolute; protectedPaths.add(absolute);
    }
    return result;
  });
  return { schemaVersion: 1, manifestPath: filename, sourceOrigin: source, targetOrigin: target, cases, protectedPaths: [...protectedPaths] };
}
async function readJsonFile(filename, limit, name) {
  const metadata = await stat(filename);
  if (!metadata.isFile() || metadata.size > limit) throw new Error(`${name} must be a regular file no larger than ${limit} bytes`);
  const content = await readFile(filename);
  if (content.length > limit) throw new Error(`${name} must be no larger than ${limit} bytes`);
  try { return JSON.parse(content.toString('utf8')); } catch { throw new Error(`${name} must contain valid JSON`); }
}
/** Validate every action before output deletion, writes, or the first capture. */
export async function loadSuite(filename, overrides = {}) {
  const manifestPath = path.resolve(filename);
  const input = await readJsonFile(manifestPath, 1000000, 'suite manifest');
  const plan = normalizeSuite(input, { ...overrides, manifestPath });
  for (const actionFile of plan.protectedPaths.slice(1)) {
    const actions = await readJsonFile(actionFile, 100000, 'actions file');
    normalizeActions(actions);
  }
  return plan;
}
export function buildVerifyArgs(item, out, executablePath) {
  const args = ['--source', item.sourceUrl, '--target', item.targetUrl, '--out', out,
    '--widths', item.widths.join(','), '--height', String(item.height), '--scheme', item.scheme, '--state', item.state];
  for (const [key, flag] of [['sourceActions', '--source-actions'], ['targetActions', '--target-actions']]) if (item[key]) args.push(flag, item[key]);
  if (item.browser !== undefined) args.push('--browser', item.browser);
  if (item.keepScroll) args.push('--keep-scroll');
  if (item.maxDiffRatio !== null) args.push('--max-diff-ratio', String(item.maxDiffRatio));
  if (executablePath) args.push('--executable-path', executablePath);
  return args;
}
