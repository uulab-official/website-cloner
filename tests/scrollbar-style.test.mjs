import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { collectDomEvidence } from '../scripts/lib/page-evidence.mjs';

test('horizontal scrollbar space alone is not vertical content overflow', () => {
  const root = { clientWidth: 384, clientHeight: 894, scrollWidth: 500, scrollHeight: 894 };
  const fonts = []; fonts.status = 'loaded';
  const document = { documentElement: root, body: { ...root, innerText: '' }, compatMode: 'CSS1Compat', baseURI: 'https://fixture.test/', title: 'Fixture', querySelectorAll: () => [], images: [], styleSheets: [], fonts };
  const limits = { headings: 10, keyElements: 10, links: 10, images: 10, visibleTextLength: 1000, urlLength: 1000, overflowScan: 100, overflowElements: 10 };
  const e = vm.runInNewContext(`(${collectDomEvidence.toString()})(limits)`, { document, limits, innerWidth: 390, innerHeight: 900, scrollX: 0, scrollY: 0, location: { href: document.baseURI }, navigator: { userAgent: 'fixture' }, URL });
  assert.equal(e.overflow.vertical, false);
});
const enabled = Boolean(process.env.CAPTURE_TEST_BUNDLED_BROWSER || process.env.CAPTURE_TEST_EXECUTABLE_PATH);
const engines = process.env.CLONER_CAPTURE_ENGINES?.split(',') ?? ['chromium'];
assert.ok(engines.length && engines.every(e => ['chromium', 'firefox', 'webkit'].includes(e)), 'unknown test engine');
for (const engine of engines) {
  test(`authored ${engine} example preserves the observed scrollbar styling`, { skip: !enabled, timeout: 30000 }, async () => {
    const pw = await import('playwright');
    const browser = await pw[engine].launch(engine === 'chromium' && process.env.CAPTURE_TEST_EXECUTABLE_PATH ? { executablePath: process.env.CAPTURE_TEST_EXECUTABLE_PATH } : {});
    try {
      const css = await readFile(new URL('../examples/uulab-services/src/styles.css', import.meta.url), 'utf8');
      const p = await browser.newPage({ viewport: { width: 390, height: 900 } });
      await p.setContent(`<!doctype html><style>${css}</style><main style="height:2000px"><div class="container">Fixture</div></main>`);
      const observed = await p.evaluate(() => {
        const root = document.documentElement;
        const rules = Array.from(document.styleSheets[0].cssRules);
        const declared = selector => rules.find(rule => rule.selectorText === selector)?.style;
        return { declaredTrack: declared('::-webkit-scrollbar-track')?.backgroundColor, declaredThumb: declared('::-webkit-scrollbar-thumb')?.backgroundColor, declaredRadius: declared('::-webkit-scrollbar-thumb')?.borderRadius,
          width: getComputedStyle(root, '::-webkit-scrollbar').width, track: getComputedStyle(root, '::-webkit-scrollbar-track').backgroundColor,
          thumb: getComputedStyle(root, '::-webkit-scrollbar-thumb').backgroundColor, radius: getComputedStyle(root, '::-webkit-scrollbar-thumb').borderRadius,
          overflow: root.scrollWidth > root.clientWidth, contentWidth: document.querySelector('.container').getBoundingClientRect().width, available: root.clientWidth };
      });
      assert.equal(observed.width, '6px');
      assert.equal(observed.declaredTrack, 'rgb(249, 250, 251)');
      assert.equal(observed.declaredThumb, 'rgb(37, 99, 235)'); assert.equal(observed.declaredRadius, '3px');
      // The pinned Firefox source/target return no computed thumb/track style.
      // Validate its declarations and actual geometry, not invented paint support.
      if (engine === 'firefox') {
        assert.equal(observed.track, ''); assert.equal(observed.thumb, ''); assert.equal(observed.radius, '');
      } else {
        assert.equal(observed.track, 'rgb(249, 250, 251)');
        assert.equal(observed.thumb, 'rgb(37, 99, 235)'); assert.equal(observed.radius, '3px');
      }
      assert.equal(observed.overflow, false); assert.equal(observed.contentWidth, observed.available);
    } finally { await browser.close(); }
  });
}
