import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { observeCapture } from '../scripts/lib/observations.mjs';
async function fixture(t, extension) {
  const dir = await mkdtemp(path.join(tmpdir(), 'media-observe-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const capture = path.join(dir, 'capture'), out = path.join(dir, 'report'); await mkdir(path.join(capture, '1x1'), { recursive: true });
  const m = { schemaVersion: 1, tool: 'website-cloner/capture', status: 'completed', timestamp: '2026-11-02T00:00:00Z', requestedUrl: 'https://source.test/', browser: 'chromium', actualBrowser: 'chromium', browserVersion: 'test', widths: [1], height: 1, state: 'default', scheme: 'light', captures: [{ width: 1, height: 1, directory: '1x1', status: 'completed' }] };
  const p = { ...m, finalUrl: m.requestedUrl, title: 'Media', environment: { browser: 'chromium', browserVersion: 'test' }, viewport: { width: 1, height: 1, deviceScaleFactor: 1 }, document: { width: 1, height: 1 }, screenshots: { viewport: 'viewport.png', fullPage: 'full-page.png' }, actions: [], headings: [], keyElements: [], links: [], images: [], totals: { headings: 0, keyElements: 0, links: 0, images: 0 }, fonts: { status: 'loaded', faces: [] }, consoleErrors: [], pageErrors: [], requestFailures: [], failedResponses: [], visualAssets: extension };
  await writeFile(path.join(capture, 'capture.json'), JSON.stringify(m)); await writeFile(path.join(capture, '1x1/page.json'), JSON.stringify(p));
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
  for (const name of ['viewport.png', 'full-page.png']) await writeFile(path.join(capture, '1x1', name), image);
  return { capture, out };
}
const extension = () => ({ schemaVersion: 1, backgrounds: [{ selector: '<script>alert(1)</script>', pseudo: '::before', cssText: 'url("https://source.test/shared.svg")', truncated: false }], media: [{ selector: '#movie', tag: 'video', role: 'poster', url: 'https://source.test/shared.svg', selected: null, declaredType: '', media: '', truncated: false }, { selector: '#movie', tag: 'video', role: 'source', url: 'https://source.test/movie.mp4', selected: null, declaredType: 'video/mp4', media: '', truncated: false }], coverage: { totalElements: 3, scannedElements: 3, totalMedia: 1, scannedMedia: 1, droppedBackgrounds: 0, droppedSources: 0, truncatedStrings: 0 } });
test('observer merges extended assets, reports roles safely and leaves MIME/rights/playback unknown', async t => {
  const f = await fixture(t, extension()); const result = await observeCapture(f);
  assert.equal(result.assetCandidates, 2); assert.equal(result.imageCandidates, 1);
  const ledger = JSON.parse(await readFile(path.join(f.out, 'assets.json'))), report = JSON.parse(await readFile(path.join(f.out, 'observation.json')));
  assert.equal(ledger.assets[0].observations.length, 2); assert.equal(ledger.assets[1].content_type, null); assert.equal(ledger.assets[1].observations[0].declaredType, 'video/mp4');
  assert.equal(report.assetCoverage[0].status, 'recorded'); assert.equal(report.visualComparison, 'not_performed');
  const html = await readFile(path.join(f.out, 'index.html'), 'utf8'); assert.match(html, /Asset candidates/); assert.match(html, /css-background/);
  assert.doesNotMatch(html, /<script|<video|<audio|<img|src=["']https?:/i);
});
test('observer rejects malformed new extension before creating output', async t => {
  const bad = extension(); bad.schemaVersion = 99; const f = await fixture(t, bad);
  await assert.rejects(observeCapture(f), /media asset schema/); await assert.rejects(stat(f.out), { code: 'ENOENT' });
});
test('observer labels legacy extended coverage as unrecorded, not complete', async t => {
  const f = await fixture(t, undefined); await observeCapture(f); const r = JSON.parse(await readFile(path.join(f.out, 'observation.json')));
  assert.equal(r.assetCoverage[0].status, 'not_recorded'); assert.ok(r.warnings.some(w => w.code === 'media_not_recorded'));
});
