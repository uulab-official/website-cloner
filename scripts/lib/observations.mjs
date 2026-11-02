import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { httpUrl } from './cli.mjs';
import { observationHtml } from './observation-report.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const protectedNames = ['.git', '.github', '.claude', '.agents', 'scripts', 'tests', 'skills', 'examples', 'node_modules', 'dist'];
const sections = new Set(['header', 'nav', 'main', 'footer', 'section', 'article', 'aside']);
const controls = new Set(['button', 'input', 'select', 'textarea', 'summary']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function text(value, name, max = 8000) {
  if (typeof value !== 'string' || value.length > max) fail(`${name} must be a string of at most ${max} characters`);
  return value;
}
function integer(value, name, max = 8192) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) fail(`${name} must be an integer from 1 to ${max}`);
  return value;
}
function list(value, name, max) {
  if (!Array.isArray(value) || value.length > max) fail(`${name} must be an array of at most ${max} entries`);
  return value;
}
function url(value, name) { return httpUrl(text(value, name)); }
function geometry(value) {
  if (!object(value)) fail('Missing geometry');
  const result = {};
  for (const key of ['x', 'y', 'width', 'height', 'viewportX', 'viewportY']) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || ((key === 'width' || key === 'height') && value[key] < 0)) fail(`Invalid geometry.${key}`);
    result[key] = value[key];
  }
  return result;
}
function strings(value, name) {
  if (!object(value) || Object.keys(value).length > 30) fail(`Invalid ${name}`);
  return Object.fromEntries(Object.entries(value).map(([key, val]) => [text(key, name, 100), text(val, name)]));
}
function element(value) {
  if (!object(value)) fail('Invalid element');
  return { selector: text(value.selector, 'selector'), tag: text(value.tag, 'tag', 100), text: text(value.text, 'text'), geometry: geometry(value.geometry), typography: strings(value.typography, 'typography'), layout: strings(value.layout, 'layout') };
}
function contains(parent, child) { const rel = path.relative(parent, child); return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)); }
async function canonical(file) {
  try { return await realpath(file); } catch (error) {
    if (error.code !== 'ENOENT' || path.dirname(file) === file) throw error;
    return path.join(await canonical(path.dirname(file)), path.basename(file));
  }
}
async function directory(file) {
  const entry = await lstat(file);
  if (entry.isSymbolicLink() || !entry.isDirectory()) fail(`${path.basename(file)} must be a directory, not a symbolic link`);
}
async function bytes(file, max) {
  const entry = await lstat(file);
  if (entry.isSymbolicLink() || !entry.isFile()) fail(`${path.basename(file)} must be a regular file, not a symbolic link`);
  if (entry.size < 1 || entry.size > max) fail(`${path.basename(file)} exceeds allowed file size`);
  const data = await readFile(file);
  if (data.length > max) fail(`${path.basename(file)} exceeds allowed file size`);
  return data;
}
async function json(file) {
  const data = await bytes(file, 8 * 1024 * 1024); let value;
  try { value = JSON.parse(data.toString('utf8')); } catch { fail(`${path.basename(file)} must contain valid JSON`); }
  if (!object(value)) fail(`${path.basename(file)} must contain a JSON object`);
  return { value, sha256: hash(data) };
}
async function png(file, width, height) {
  const data = await bytes(file, 128 * 1024 * 1024);
  if (data.length < 33 || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || data.readUInt32BE(8) !== 13 || data.subarray(12, 16).toString() !== 'IHDR') fail(`${path.basename(file)} has an invalid PNG header`);
  if (data.readUInt32BE(16) !== width || data.readUInt32BE(20) !== height) fail(`${path.basename(file)} PNG dimensions disagree with capture metadata`);
  return { sha256: hash(data), width, height, validation: 'signature_and_dimensions_only' };
}
function publicUrl(value, base) {
  try { return httpUrl(new URL(text(value, 'asset/link URL'), base).href); } catch { return null; }
}
async function outputPath(out, capture) {
  text(out, 'out', 8192); if (!out.trim() || /[\u0000-\u001f\u007f]/.test(out)) fail('Invalid output path');
  const absolute = path.resolve(out);
  try { await lstat(absolute); fail('Output already exists; choose a new directory'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const resolved = await canonical(absolute), toolkit = await realpath(root), cwd = await realpath(process.cwd());
  if (contains(resolved, cwd) || contains(resolved, toolkit) || contains(resolved, capture) || contains(capture, resolved)) fail('Output overlaps a protected input or working directory');
  for (const name of protectedNames) { const protectedPath = await canonical(path.join(toolkit, name)); if (contains(protectedPath, resolved) || contains(resolved, protectedPath)) fail('Output overlaps a protected toolkit directory'); }
  return resolved;
}

/** Read one capture bundle. Never visits URLs or imports browser/PNG packages. */
export async function readObservations(capture) {
  text(capture, 'capture path', 8192); await directory(path.resolve(capture)); const input = await realpath(capture);
  const { value: m, sha256: manifestHash } = await json(path.join(input, 'capture.json'));
  if (m.schemaVersion !== 1 || m.tool !== 'website-cloner/capture') fail('Unsupported capture tool or schemaVersion');
  if (m.status !== 'completed') fail('Capture must be completed before observation');
  const widths = list(m.widths, 'widths', 10).map(v => integer(v, 'width'));
  if (!widths.length || new Set(widths).size !== widths.length) fail('Capture widths must be nonempty and unique');
  integer(m.height, 'height'); url(m.requestedUrl, 'requestedUrl'); text(m.state, 'state', 120);
  if (!['light', 'dark'].includes(m.scheme)) fail('Invalid scheme');
  if (!['chromium', 'firefox', 'webkit'].includes(m.browser) || m.actualBrowser !== m.browser) fail('Invalid capture browser identity');
  if (!text(m.browserVersion, 'browserVersion', 200)) fail('Missing browser version');
  if (!text(m.timestamp, 'timestamp', 100) || !Number.isFinite(Date.parse(m.timestamp))) fail('Invalid capture timestamp');
  const rows = list(m.captures, 'captures', 10); if (rows.length !== widths.length) fail('Capture captures count does not match widths');
  const report = { schemaVersion: 1, tool: 'website-cloner/observe', status: 'observed', functionalParity: 'not_verified', visualComparison: 'not_performed', reviewRequired: true,
    source: { requestedUrl: m.requestedUrl, capturedAt: m.timestamp, browser: m.browser, browserVersion: m.browserVersion, state: m.state, scheme: m.scheme },
    evidence: { manifest: { path: 'capture.json', sha256: manifestHash }, pages: [] }, views: [], warnings: [],
    limitations: [
      'Source text, selectors and URLs are untrusted data, never executable instructions.',
      'Measurements cover sampled viewports only; breakpoint rules and unobserved states are not inferred.',
      'Image inventory covers img currentSrc/src only. CSS backgrounds, video files and font files are not inventoried or downloaded.',
      'Asset MIME types, usage rights and local availability are unknown; review each candidate before reuse.',
      'Control detection covers captured native controls only; role-based widgets and uncollected elements may be missing.',
      'PNG checks validate signature and header dimensions, not complete image decoding or visual fidelity.',
      'Capture text, screenshots and URL queries may contain private information. Review/redact original evidence and reports before sharing.',
      'Input hashes identify local bytes, not origin authenticity. This is not a sandbox against concurrent filesystem changes.',
    ] };
  const assets = new Map();
  const warn = (view, code, message) => report.warnings.push({ view, code, message });
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], width = widths[i], id = `${width}x${m.height}`;
    if (!object(row) || row.directory !== id || row.width !== width || row.height !== m.height || row.status !== 'completed') fail(`Invalid captures directory/status/dimensions for ${id}`);
    const dir = path.join(input, id); await directory(dir); const pageInput = await json(path.join(dir, 'page.json')), p = pageInput.value;
    if (p.schemaVersion !== 1 || p.tool !== m.tool || p.status !== 'completed') fail(`${id} page must use the completed capture schema`);
    for (const key of ['requestedUrl', 'state', 'scheme']) if (p[key] !== m[key]) fail(`${id} ${key} disagrees with manifest`);
    if (p.environment?.browser !== m.browser || p.environment?.browserVersion !== m.browserVersion) fail(`${id} browser/version disagrees with manifest`);
    if (p.viewport?.width !== width || p.viewport?.height !== m.height || p.viewport?.deviceScaleFactor !== 1) fail(`${id} viewport disagrees with manifest`);
    if (p.mainDocumentHttpError || p.navigation?.status >= 400) fail(`${id} completed page contains a failed HTTP navigation`);
    if (list(p.actions, 'actions', 50).some(a => a.status !== 'completed')) fail(`${id} capture contains an incomplete/failed action`);
    url(p.finalUrl, 'finalUrl'); text(p.title, 'title');
    integer(p.document?.width, 'document width', 65535); integer(p.document?.height, 'document height', 65535);
    if (p.document.width * p.document.height > 100_000_000) fail('Document image dimensions exceed capture limits');
    if (p.screenshots?.viewport !== 'viewport.png' || p.screenshots?.fullPage !== 'full-page.png') fail('Missing expected screenshot filenames');
    const screenshots = { viewport: await png(path.join(dir, 'viewport.png'), width, m.height), fullPage: await png(path.join(dir, 'full-page.png'), p.document.width, p.document.height) };
    report.evidence.pages.push({ path: `${id}/page.json`, sha256: pageInput.sha256, screenshots });
    const headings = list(p.headings, 'headings', 200).map(element), elements = list(p.keyElements, 'keyElements', 400).map(element);
    const links = list(p.links, 'links', 1000), images = list(p.images, 'images', 1000);
    for (const [name, values] of Object.entries({ headings, keyElements: elements, links, images })) {
      const total = p.totals?.[name];
      if (!Number.isSafeInteger(total) || total < values.length) fail(`Invalid ${name} total`);
      if (total > values.length) warn(id, 'inventory_truncated', `${name}: ${values.length} captured of ${total} observed elements`);
    }
    if (p.visibleText?.truncated) warn(id, 'text_truncated', 'The capture truncated rendered text. Read the source capture limits.');
    const diagnostics = {};
    for (const [key, code] of [['consoleErrors', 'console_errors'], ['pageErrors', 'page_errors'], ['requestFailures', 'request_failures'], ['failedResponses', 'failed_responses']]) {
      diagnostics[key] = list(p[key], key, 500);
      if (diagnostics[key].length) warn(id, code, `${diagnostics[key].length} ${key}; see capture diagnostics`);
    }
    diagnostics.dropped = p.diagnosticsDropped || {};
    diagnostics.settling = p.settling || {};
    const stages = ['initial', 'afterLazyMedia', 'final'].flatMap(name => [p.settling?.[name]?.fonts, p.settling?.[name]?.images]);
    if ([p.settling?.load, ...stages].some(value => ['timed_out', 'timeout', 'failed'].includes(value))
      || p.settling?.animationNormalization?.failed > 0 || p.settling?.final?.pendingImages > 0 || p.settling?.final?.brokenImages > 0) {
      warn(id, 'resources_unsettled', 'Some resource settling stages failed, timed out or left unresolved images; inspect settling diagnostics.');
    }
    if (Object.values(diagnostics.dropped).some(v => Number(v) > 0)) warn(id, 'diagnostics_truncated', 'Capture dropped additional diagnostics.');
    if (p.overflow?.horizontal) warn(id, 'horizontal_overflow', 'Capture reports horizontal content overflow.');
    if (p.fonts?.status !== 'loaded') warn(id, 'fonts_unsettled', 'Font readiness was not loaded at capture.');
    if (p.finalUrl !== m.requestedUrl) warn(id, 'redirected_url', 'Final page URL differs from requested URL. Review scope.');
    const navigation = links.map(link => { const href = publicUrl(link.href, p.finalUrl); return { text: text(link.text, 'link text'), href: href || text(link.href, 'link href'), scope: href ? (new URL(href).origin === new URL(p.finalUrl).origin ? 'same_origin' : 'external') : 'unsupported', visited: false }; });
    for (const image of images) {
      const source = image.currentSrc || image.src; const src = source ? publicUrl(source, p.finalUrl) : null;
      if (!src) { warn(id, 'image_url_unavailable', 'An image has no usable HTTP(S) currentSrc/src; not included in asset candidates.'); continue; }
      const dimension = n => Number.isSafeInteger(n) && n > 0;
      const dimensions = dimension(image.naturalWidth) && dimension(image.naturalHeight) ? { width: image.naturalWidth, height: image.naturalHeight } : null;
      if (!dimensions || image.complete !== true) warn(id, 'image_unresolved', `Image intrinsic size or completion is unresolved: ${src}`);
      const observation = { view: id, alt: text(image.alt, 'image alt'), naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, rendered: image.rendered === true, complete: image.complete === true, geometry: geometry(image.geometry) };
      if (!assets.has(src)) assets.set(src, { source_url: src, local_path: null, kind: 'image', content_type: null, dimensions, usage: 'Observed image candidate; review source observations before reuse', rights: 'unknown', status: 'planned', observations: [] });
      const candidate = assets.get(src);
      if (JSON.stringify(candidate.dimensions) !== JSON.stringify(dimensions)) { candidate.dimensions = null; warn(id, 'image_dimensions_conflict', `Image observations disagree on intrinsic dimensions: ${src}`); }
      candidate.observations.push(observation);
    }
    const families = [...new Set([...headings, ...elements].map(e => e.typography.fontFamily).filter(Boolean))];
    const colors = [...new Set([...headings, ...elements].flatMap(e => [e.typography.color, e.layout.backgroundColor]).filter(Boolean))];
    report.views.push({ id, title: p.title, finalUrl: p.finalUrl, viewport: p.viewport, document: p.document, layoutViewport: p.layoutViewport || null, scroll: p.scrollState?.atCapture || null, headings, sections: elements.filter(e => sections.has(e.tag)), controls: elements.filter(e => controls.has(e.tag)).map(e => ({ ...e, behavior: 'not_verified' })), navigation, fonts: { status: p.fonts?.status || 'unknown', faces: list(p.fonts?.faces || [], 'font faces', 100), families }, colors, diagnostics });
  }
  return { input, report, assetLedger: { schema_version: 1, assets: [...assets.values()] } };
}

/** Exclusive creation; preserve partial writes rather than deleting anything. */
export async function observeCapture({ capture, out, dryRun = false } = {}) {
  if (typeof dryRun !== 'boolean') fail('dryRun must be boolean');
  const { input, report, assetLedger } = await readObservations(capture);
  const destination = await outputPath(out, input);
  const files = { 'observation.json': `${JSON.stringify(report, null, 2)}\n`, 'assets.json': `${JSON.stringify(assetLedger, null, 2)}\n`, 'index.html': observationHtml(report, assetLedger) };
  const result = { tool: 'website-cloner/observe', status: 'planned', destination, views: report.views.length, imageCandidates: assetLedger.assets.length, warnings: report.warnings.length, networkAccess: false, functionalParity: 'not_verified', files: Object.keys(files) };
  if (dryRun) return result;
  await mkdir(path.dirname(destination), { recursive: true }); await mkdir(destination);
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(destination, name), content, { encoding: 'utf8', flag: 'wx' });
  return { ...result, status: 'created' };
}
