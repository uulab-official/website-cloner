import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = args => spawnSync(process.execPath, [path.join(root, 'scripts/observe.mjs'), ...args], { encoding: 'utf8', timeout: 30000 });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function png(width, height) {
  const chunk = (type, data) => {
    const contents = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
    for (const byte of contents) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    const out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length); contents.copy(out, 4); out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, out.length - 4); return out;
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.alloc((width * 4 + 1) * height))), chunk('IEND', Buffer.alloc(0))]);
}
async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'cloner-observe-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const capture = path.join(dir, 'capture'), out = path.join(dir, 'report'); await mkdir(capture);
  const manifest = { schemaVersion: 1, tool: 'website-cloner/capture', status: 'completed', timestamp: '2026-11-02T00:00:00.000Z', requestedUrl: 'https://source.test/page', browser: 'chromium', actualBrowser: 'chromium', browserVersion: 'test-version', state: 'default', scheme: 'light', widths: [120, 240], height: 80, captures: [] };
  for (const width of manifest.widths) {
    const id = `${width}x80`; await mkdir(path.join(capture, id));
    const geometry = { x: 0, y: 0, width, height: 40, viewportX: 0, viewportY: 0 };
    const element = { selector: '#hero', tag: 'section', text: 'Hero', geometry, typography: { fontFamily: 'sans-serif', fontSize: width === 120 ? '24px' : '40px', color: 'rgb(0, 0, 0)' }, layout: { display: 'grid', gridTemplateColumns: width === 120 ? '120px' : '120px 120px', backgroundColor: 'rgb(255, 255, 255)' } };
    const page = { ...manifest, viewport: { width, height: 80, deviceScaleFactor: 1 }, finalUrl: manifest.requestedUrl, title: 'Source', environment: { browser: 'chromium', browserVersion: 'test-version' }, document: { width, height: 160, language: 'en' }, layoutViewport: { width, height: 80 }, scrollState: { atCapture: { x: 0, y: 0 } }, headings: [{ ...element, selector: '#title', tag: 'h1' }], keyElements: [element, { ...element, selector: '#buy', tag: 'button', text: 'Buy' }], links: [{ href: '/details', text: 'Details', geometry }, { href: 'https://other.test', text: 'External', geometry }], images: [{ src: 'https://source.test/fallback.jpg', currentSrc: `https://source.test/hero-${width}.webp`, alt: 'Hero image', naturalWidth: 600, naturalHeight: 300, rendered: true, complete: true, geometry }, { src: 'https://source.test/shared.webp', currentSrc: '', alt: 'Shared', naturalWidth: 20, naturalHeight: 10, rendered: true, complete: true, geometry }], fonts: { status: 'loaded', faces: [] }, totals: { headings: 1, keyElements: 2, links: 2, images: 2 }, visibleText: { truncated: false }, consoleErrors: [], pageErrors: [], requestFailures: [], failedResponses: [], diagnosticsDropped: {}, overflow: { horizontal: false }, actions: [], screenshots: { viewport: 'viewport.png', fullPage: 'full-page.png', motionVerified: false } };
    await writeFile(path.join(capture, id, 'page.json'), JSON.stringify(page));
    await writeFile(path.join(capture, id, 'viewport.png'), png(width, 80)); await writeFile(path.join(capture, id, 'full-page.png'), png(width, 160));
    manifest.captures.push({ width, height: 80, status: 'completed', directory: id, error: null });
  }
  await writeFile(path.join(capture, 'capture.json'), JSON.stringify(manifest));
  const edit = async (file, change) => { const p = path.join(capture, file); const data = JSON.parse(await readFile(p)); change(data); await writeFile(p, JSON.stringify(data)); };
  return { dir, capture, out, edit, args: ['--capture', capture, '--out', out] };
}
async function rejected(t, change, pattern) {
  const f = await fixture(t); await change(f); const result = run(f.args);
  assert.equal(result.status, 1, result.stdout + result.stderr); assert.match(result.stderr, pattern);
  await assert.rejects(stat(f.out), { code: 'ENOENT' });
}

test('help works offline and discloses that observation is not implementation or permission', () => { const r = run(['--help']); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /offline/i); assert.match(r.stdout, /rights/i); });
test('generates portable measured views and responsive image candidates without inventing parity', async t => {
  const f = await fixture(t); const r = run(f.args); assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(await readFile(path.join(f.out, 'observation.json'))), assets = JSON.parse(await readFile(path.join(f.out, 'assets.json')));
  assert.equal(report.status, 'observed'); assert.equal(report.functionalParity, 'not_verified'); assert.equal(report.visualComparison, 'not_performed');
  assert.equal(report.views.length, 2); assert.equal(report.views[0].sections[0].selector, '#hero');
  assert.notEqual(report.views[0].sections[0].layout.gridTemplateColumns, report.views[1].sections[0].layout.gridTemplateColumns);
  assert.equal(report.views[0].controls[0].selector, '#buy'); assert.equal(report.views[0].controls[0].behavior, 'not_verified');
  assert.equal(report.views[0].navigation[0].scope, 'same_origin'); assert.equal(report.views[0].navigation[1].scope, 'external');
  assert.equal(report.views[0].headings[0].typography.fontSize, '24px');
  assert.equal(assets.schema_version, 1); assert.equal(assets.assets.length, 3);
  assert.equal(assets.assets.find(a => a.source_url.endsWith('/shared.webp')).observations.length, 2);
  for (const a of assets.assets) { assert.equal(a.rights, 'unknown'); assert.equal(a.content_type, null); assert.equal(a.local_path, null); assert.equal(a.status, 'planned'); }
  assert.equal(report.evidence.manifest.sha256, hash(await readFile(path.join(f.capture, 'capture.json'))));
  assert.equal(report.evidence.pages[0].sha256, hash(await readFile(path.join(f.capture, '120x80/page.json'))));
});
test('dry run validates all evidence but creates no directories', async t => { const f = await fixture(t); f.out = path.join(f.dir, 'absent/parent/report'); const r = run(['--capture', f.capture, '--out', f.out, '--dry-run']); assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).status, 'planned'); await assert.rejects(stat(path.dirname(f.out)), { code: 'ENOENT' }); });
for (const [name, change, pattern] of [
  ['failed manifest', f => f.edit('capture.json', j => { j.status = 'failed'; }), /completed/i],
  ['foreign tool', f => f.edit('capture.json', j => { j.tool = 'other'; }), /capture/i],
  ['unknown schema', f => f.edit('capture.json', j => { j.schemaVersion = 2; }), /schema/i],
  ['missing viewport row', f => f.edit('capture.json', j => { j.captures.pop(); }), /captures/i],
  ['duplicate widths', f => f.edit('capture.json', j => { j.widths = [120, 120]; }), /width/i],
  ['path traversal', f => f.edit('capture.json', j => { j.captures[0].directory = '../outside'; }), /directory/i],
  ['failed page', f => f.edit('120x80/page.json', j => { j.status = 'failed'; }), /completed/i],
  ['mixed origin', f => f.edit('120x80/page.json', j => { j.requestedUrl = 'https://other.test/'; }), /requestedUrl/i],
  ['mixed browser', f => f.edit('120x80/page.json', j => { j.environment.browser = 'firefox'; }), /browser/i],
  ['mixed version', f => f.edit('120x80/page.json', j => { j.environment.browserVersion = 'different'; }), /version/i],
  ['mixed state', f => f.edit('120x80/page.json', j => { j.state = 'menu'; }), /state/i],
  ['mixed scheme', f => f.edit('120x80/page.json', j => { j.scheme = 'dark'; }), /scheme/i],
  ['mismatched viewport', f => f.edit('120x80/page.json', j => { j.viewport.width = 240; }), /viewport/i],
  ['malformed headings', f => f.edit('120x80/page.json', j => { j.headings = null; }), /headings/i],
  ['too many images', f => f.edit('120x80/page.json', j => { j.images = Array(1001).fill({}); }), /images/i],
  ['nonfinite geometry', f => f.edit('120x80/page.json', j => { j.keyElements[0].geometry.width = null; }), /geometry/i],
  ['missing image', f => rm(path.join(f.capture, '120x80/viewport.png')), /viewport.png/i],
  ['invalid image', f => writeFile(path.join(f.capture, '120x80/viewport.png'), 'not an image'), /PNG/i],
  ['image dimension mismatch', f => writeFile(path.join(f.capture, '120x80/viewport.png'), png(1, 1)), /dimensions/i],
  ['oversized JSON', f => writeFile(path.join(f.capture, '120x80/page.json'), ' '.repeat(8 * 1024 * 1024 + 1)), /size/i],
  ['invalid JSON', f => writeFile(path.join(f.capture, '120x80/page.json'), '{oops'), /JSON/i],
  ['symlink page', async f => { await rm(path.join(f.capture, '120x80/page.json')); await symlink(path.join(f.capture, '240x80/page.json'), path.join(f.capture, '120x80/page.json')); }, /symbolic|regular/i],
  ['symlink viewport directory', async f => { await rm(path.join(f.capture, '120x80'), { recursive: true }); await symlink(path.join(f.capture, '240x80'), path.join(f.capture, '120x80')); }, /symbolic|directory/i],
]) test(`rejects ${name} before writing`, async t => rejected(t, change, pattern));
test('reports truncation, failed resources, missing font readiness and real overflow', async t => {
  const f = await fixture(t); await f.edit('120x80/page.json', j => { j.totals.keyElements = 999; j.visibleText.truncated = true; j.pageErrors = [{ message: '<script>bad()</script>' }]; j.fonts.status = 'loading'; j.overflow.horizontal = true; });
  const r = run(f.args); assert.equal(r.status, 0, r.stderr); const report = JSON.parse(await readFile(path.join(f.out, 'observation.json')));
  for (const code of ['inventory_truncated', 'text_truncated', 'page_errors', 'fonts_unsettled', 'horizontal_overflow']) assert.ok(report.warnings.some(w => w.code === code), code);
  assert.equal(report.reviewRequired, true);
});
test('HTML source strings remain escaped, URLs are not active links, and no script is embedded', async t => {
  const f = await fixture(t); await f.edit('120x80/page.json', j => { j.title = '<script>alert(1)</script>'; j.headings[0].text = '<img src=x onerror=alert(1)>'; j.links[0].href = 'javascript:alert(1)'; });
  const r = run(f.args); assert.equal(r.status, 0, r.stderr); const html = await readFile(path.join(f.out, 'index.html'), 'utf8');
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('&lt;img')); assert.doesNotMatch(html, /<script|<iframe|<img|href=["']javascript:/i);
});
test('data/blob image URLs are not downloadable candidates; missing intrinsic size stays unknown', async t => {
  const f = await fixture(t); await f.edit('120x80/page.json', j => { j.images[0].currentSrc = 'data:image/png;base64,AAAA'; j.images[1].naturalWidth = 0; j.images[1].naturalHeight = 0; });
  const r = run(f.args); assert.equal(r.status, 0, r.stderr); const report = JSON.parse(await readFile(path.join(f.out, 'observation.json')));
  assert.ok(report.warnings.some(w => w.code === 'image_url_unavailable')); assert.ok(report.warnings.some(w => w.code === 'image_unresolved'));
});
test('preserves repeated-image dimension disagreements instead of inventing one intrinsic size', async t => {
  const f = await fixture(t); await f.edit('120x80/page.json', j => { j.images[1].naturalWidth = 21; });
  const r = run(f.args); assert.equal(r.status, 0, r.stderr); const assets = JSON.parse(await readFile(path.join(f.out, 'assets.json')));
  assert.equal(assets.assets.find(a => a.source_url.endsWith('/shared.webp')).dimensions, null);
});
for (const leaf of ['', 'empty', 'capture', 'capture/inside', 'scripts/observe-test-output']) test(`protects existing/input/toolkit output ${leaf || 'parent'}`, async t => {
  const f = await fixture(t); const out = leaf.startsWith('scripts/') ? path.join(root, leaf) : path.join(f.dir, leaf);
  if (leaf === 'empty') await mkdir(out);
  const r = run(['--capture', f.capture, '--out', out]); assert.equal(r.status, 1, r.stdout); assert.match(r.stderr, /existing|overlap|protected|exists/i);
  assert.ok((await stat(path.join(f.capture, 'capture.json'))).isFile());
});
test('rejects symbolic output and never modifies its target', async t => { const f = await fixture(t); await symlink(f.capture, f.out); const r = run(f.args); assert.equal(r.status, 1); assert.ok((await stat(path.join(f.capture, 'capture.json'))).isFile()); });
for (const args of [[], ['--overwrite'], ['--unknown'], ['--capture','x','--capture','y'], ['--dry-run=false']]) test(`CLI rejects unsupported/missing arguments ${JSON.stringify(args)}`, () => { const r = run(args); assert.equal(r.status, 1); assert.match(r.stderr, /Required|Unknown|Duplicate|does not take/); });
for (const [label, change] of [
  ['navigation failure', p => { p.navigation = { status: 503 }; }],
  ['main document error', p => { p.mainDocumentHttpError = 500; }],
  ['failed action', p => { p.actions = [{ type: 'click', status: 'failed' }]; }],
]) test(`rejects completed page contradicting ${label}`, async t => rejected(t, f => f.edit('120x80/page.json', change), /failed|HTTP|action/i));
test('non-settled resource stages are visible even when the capture completed', async t => {
  const f = await fixture(t); await f.edit('120x80/page.json', p => { p.settling = { load: 'timed_out', final: { fonts: 'timed_out' } }; });
  const r = run(f.args); assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(await readFile(path.join(f.out, 'observation.json')));
  assert.ok(report.warnings.some(w => w.code === 'resources_unsettled'));
});
