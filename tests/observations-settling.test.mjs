import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readObservations } from '../scripts/lib/observations.mjs';

async function observe(t, settling) {
  const dir = await mkdtemp(path.join(tmpdir(), 'observe-settling-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, '1x1'));
  const manifest = { schemaVersion: 1, tool: 'website-cloner/capture', status: 'completed', timestamp: '2026-11-02T00:00:00Z', requestedUrl: 'https://source.test/', browser: 'chromium', actualBrowser: 'chromium', browserVersion: 'test', widths: [1], height: 1, state: 'default', scheme: 'light', captures: [{ width: 1, height: 1, directory: '1x1', status: 'completed' }] };
  const page = { ...manifest, finalUrl: manifest.requestedUrl, title: 'Fixture', environment: { browser: 'chromium', browserVersion: 'test' }, viewport: { width: 1, height: 1, deviceScaleFactor: 1 }, document: { width: 1, height: 1 }, screenshots: { viewport: 'viewport.png', fullPage: 'full-page.png' }, actions: [], headings: [], keyElements: [], links: [], images: [], totals: { headings: 0, keyElements: 0, links: 0, images: 0 }, fonts: { status: 'loaded', faces: [] }, consoleErrors: [], pageErrors: [], requestFailures: [], failedResponses: [], settling };
  await writeFile(path.join(dir, 'capture.json'), JSON.stringify(manifest));
  await writeFile(path.join(dir, '1x1/page.json'), JSON.stringify(page));
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
  for (const name of ['viewport.png', 'full-page.png']) await writeFile(path.join(dir, '1x1', name), image);
  return (await readObservations(dir)).report;
}
test('zero failures and timeout configuration do not produce resource warnings', async t => {
  const report = await observe(t, { load: 'ready', initial: { fonts: 'ready', images: 'ready', perResourceTimeoutMs: 8000 }, animationNormalization: { failed: 0 }, final: { fonts: 'ready', images: 'ready', pendingImages: 0, brokenImages: 0 } });
  assert.ok(!report.warnings.some(w => w.code === 'resources_unsettled'));
});
test('actual failures and unresolved final images remain resource warnings', async t => {
  const report = await observe(t, { animationNormalization: { failed: 2 }, final: { fonts: 'ready', images: 'ready', pendingImages: 1, brokenImages: 0 } });
  assert.ok(report.warnings.some(w => w.code === 'resources_unsettled'));
});
