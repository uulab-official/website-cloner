import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { collectDomEvidence } from '../scripts/lib/page-evidence.mjs';
import { assessPair } from '../scripts/lib/verification.mjs';

const limits = { headings: 10, keyElements: 10, links: 10, images: 10, visibleTextLength: 1000, elementTextLength: 100, urlLength: 1000, overflowScan: 100, overflowElements: 10 };
// A controlled CSSOM model pins the arithmetic; real engines are tested below.
function capture({ width = 390, height = 900, clientWidth = 384, clientHeight = 900, scrollWidth = 384, scrollHeight = 2000, bodyWidth = scrollWidth, quirks = false } = {}) {
  const box = { clientWidth, clientHeight, scrollWidth, scrollHeight, lang: 'en' };
  const body = { ...box, scrollWidth: bodyWidth, innerText: '' };
  const fonts = []; fonts.status = 'loaded';
  const document = { documentElement: box, body, scrollingElement: quirks ? body : box, compatMode: quirks ? 'BackCompat' : 'CSS1Compat', baseURI: 'https://fixture.test/', title: 'Fixture', querySelectorAll: () => [], images: [], styleSheets: [], fonts };
  return vm.runInNewContext(`(${collectDomEvidence.toString()})(limits)`, { document, limits, innerWidth: width, innerHeight: height, scrollX: 0, scrollY: 0, location: { href: document.baseURI }, navigator: { userAgent: 'fixture' }, URL });
}
test('a reserved vertical scrollbar is not horizontal content overflow', () => {
  const e = capture();
  assert.equal(e.overflow.horizontal, false);
  assert.equal(e.overflow.horizontalPixels, 0);
  assert.equal(e.overflow.documentWidth, 384);
  assert.equal(e.document.width, 390, 'preserve conservative screenshot size safety bound');
});
test('layout dimensions record the window separately from its scrollbar-reduced viewport', () => {
  const e = capture();
  assert.deepEqual(JSON.parse(JSON.stringify(e.layoutViewport)), { width: 384, height: 900, windowWidth: 390, windowHeight: 900, verticalGutter: 6, horizontalGutter: 0 });
});
test('real horizontal overflow is not reduced by subtracting the scrollbar twice', () => {
  const e = capture({ scrollWidth: 424 });
  assert.equal(e.overflow.horizontal, true); assert.equal(e.overflow.horizontalPixels, 40);
});
test('an oversized body remains content overflow', () => {
  const e = capture({ bodyWidth: 500 });
  assert.equal(e.overflow.horizontalPixels, 116);
});
test('overlay scrollbars need no artificial gutter', () => {
  const e = capture({ clientWidth: 390, scrollWidth: 390 });
  assert.equal(e.layoutViewport?.verticalGutter, 0); assert.equal(e.overflow.horizontal, false);
});
test('a horizontal scrollbar records its own reserved height', () => {
  const e = capture({ clientHeight: 894, scrollWidth: 500 });
  assert.equal(e.layoutViewport?.horizontalGutter, 6); assert.equal(e.layoutViewport?.height, 894);
});
test('short documents do not invent vertical overflow', () => {
  const e = capture({ clientWidth: 390, scrollWidth: 390, scrollHeight: 900 });
  assert.equal(e.overflow.vertical, false);
});
test('one pixel of rounding keeps the existing overflow tolerance', () => {
  const e = capture({ scrollWidth: 385 });
  assert.equal(e.overflow.horizontalPixels, 1); assert.equal(e.overflow.horizontal, false);
});
function page(width = 384) {
  return { status: 'completed', viewport: { width: 390, height: 900, deviceScaleFactor: 1 }, state: 'default', scheme: 'light', reducedMotion: 'reduce', environment: { browser: 'webkit', browserVersion: 'test', headless: true, locale: 'en-US', timezoneId: 'UTC', isMobile: false, hasTouch: false, freshContext: true }, screenshots: { viewport: 'viewport.png', animations: 'disabled', caret: 'hide' }, layoutViewport: { width, height: 900, windowWidth: 390, windowHeight: 900, verticalGutter: 390 - width, horizontalGutter: 0 } };
}
const comparison = { status: 'compared', changedPixelRatio: 0.01, maxDiffRatio: null, passed: null };
test('different layout widths require review without suppressing valid pixel evidence', () => {
  const r = assessPair(page(384), page(390), comparison);
  assert.equal(r.status, 'completed'); assert.equal(r.comparable, true); assert.equal(r.changedPixelRatio, 0.01);
  assert.match(r.warnings.join(' '), /layout viewport.*384.*390/i);
});
test('matching layout widths do not produce a mismatch warning', () => {
  assert.equal(assessPair(page(), page(), comparison).warnings.length, 0);
});
test('true horizontal content overflow is surfaced in pair diagnostics', () => {
  const source = page(); source.overflow = { horizontal: true, horizontalPixels: 40 };
  assert.match(assessPair(source, page(), comparison).warnings.join(' '), /source.*horizontal.*40/i);
});
test('mixed old/new captures disclose missing layout evidence', () => {
  const old = page(); delete old.layoutViewport;
  const r = assessPair(old, page(), comparison);
  assert.equal(r.status, 'completed'); assert.match(r.warnings.join(' '), /layout viewport.*not recorded/i);
});
for (const value of [null, {}, { ...page().layoutViewport, width: -1 }, { ...page().layoutViewport, verticalGutter: 5 }, { ...page().layoutViewport, windowWidth: 400 }]) {
  test(`malformed or inconsistent layout metadata is rejected: ${JSON.stringify(value)}`, () => {
    const source = page(); source.layoutViewport = value;
    const r = assessPair(source, page(), comparison);
    assert.equal(r.comparable, false); assert.match(r.errors.join(' '), /layout viewport/i);
  });
}

const enabled = Boolean(process.env.CAPTURE_TEST_BUNDLED_BROWSER || process.env.CAPTURE_TEST_EXECUTABLE_PATH);
const engines = process.env.CLONER_CAPTURE_ENGINES?.split(',') ?? ['chromium'];
assert.ok(engines.length && engines.every(e => ['chromium', 'firefox', 'webkit'].includes(e)), 'unknown test engine');
for (const engine of engines) {
  for (const overflowing of [false, true]) {
    test(`actual ${engine} scrollbar/content evidence: overflow=${overflowing}`, { skip: !enabled, timeout: 30000 }, async () => {
      const pw = await import('playwright');
      const browser = await pw[engine].launch(engine === 'chromium' && process.env.CAPTURE_TEST_EXECUTABLE_PATH ? { executablePath: process.env.CAPTURE_TEST_EXECUTABLE_PATH } : {});
      try {
        const p = await browser.newPage({ viewport: { width: 390, height: 900 } });
        await p.setContent(`<!doctype html><style>html{overflow-y:scroll}body{margin:0}::-webkit-scrollbar{width:6px;height:6px}main{height:2000px;${overflowing ? 'width:500px' : ''}}</style><main>Fixture</main>`);
        const expected = await p.evaluate(() => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), inner: innerWidth }));
        const e = await p.evaluate(collectDomEvidence, limits);
        assert.equal(e.overflow.horizontal, overflowing);
        assert.equal(e.overflow.horizontalPixels, Math.max(0, expected.scrollWidth - expected.width));
        assert.equal(e.layoutViewport?.width, expected.width);
        assert.equal(e.layoutViewport?.verticalGutter, expected.inner - expected.width);
      } finally { await browser.close(); }
    });
  }
}
