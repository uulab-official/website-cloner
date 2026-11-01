import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { renderPage } from '../examples/uulab-services/src/render.js';

// Authored markup, stylesheet and enhancement in a local control-only fixture.
// Placeholder images are not screenshot evidence; production assets are covered
// by demo.e2e.mjs and the separate, opt-in live comparison workflow.
const enabled = Boolean(process.env.CAPTURE_TEST_BUNDLED_BROWSER || process.env.CAPTURE_TEST_EXECUTABLE_PATH);
let browser, server, base;
before(async () => {
  if (!enabled) return;
  const { chromium } = await import('playwright');
  const css = await readFile(new URL('../examples/uulab-services/src/styles.css', import.meta.url), 'utf8');
  const js = await readFile(new URL('../examples/uulab-services/src/main.js', import.meta.url), 'utf8');
  const html = `<!doctype html><html lang="ko" data-theme="light"><meta charset="utf-8"><style>${css}</style><body>${renderPage()}<script>${js}</script></body></html>`;
  server = createServer((req, res) => {
    const asset = req.url.startsWith('/assets/');
    res.writeHead(200, { 'content-type': asset ? 'image/svg+xml' : 'text/html; charset=utf-8' });
    res.end(asset ? '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' : html);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ ...(process.env.CAPTURE_TEST_EXECUTABLE_PATH ? { executablePath: process.env.CAPTURE_TEST_EXECUTABLE_PATH } : {}) });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});
async function withPage(width, height, action) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'light', reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(`${base}/services/`, { waitUntil: 'load' });
    await action(page);
  } finally { await context.close(); }
}
const options = { skip: !enabled, timeout: 20000 };
test('mobile menu matches observed settled link geometry without losing opacity', options, async () => {
  await withPage(390, 900, async page => {
    await page.locator('.navbar-toggler').click();
    const menu = page.locator('#mobile-navigation');
    const box = await menu.boundingBox();
    assert.equal(box.x, 16);
    assert.equal(box.y, 88);
    assert.equal(box.width, 358);
    assert.equal(box.height, 346, '6 links use 24px line height, 4px spacing and no trailing margin');
    assert.equal(await menu.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    const links = await menu.locator('a').evaluateAll(elements => elements.map(el => ({ y: el.getBoundingClientRect().y, height: el.getBoundingClientRect().height })));
    assert.deepEqual(links, [109, 161, 213, 265, 317, 369].map(y => ({ y, height: 48 })));
  });
});
test('menu icon follows expanded state and resets on Escape and desktop resize', options, async () => {
  await withPage(390, 900, async page => {
    const toggle = page.locator('.navbar-toggler');
    const rotation = () => toggle.locator('svg').evaluate(el => { const m = new DOMMatrix(getComputedStyle(el).transform); return [m.a, m.b, m.c, m.d].map(n => Math.round(n)); });
    assert.deepEqual(await rotation(), [1, 0, 0, 1]);
    await toggle.click();
    assert.deepEqual(await rotation(), [0, 1, -1, 0]);
    assert.equal(await toggle.locator('svg').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    await page.keyboard.press('Escape');
    assert.deepEqual(await rotation(), [1, 0, 0, 1]);
    assert.equal(await toggle.evaluate(el => el === document.activeElement), true);
    await toggle.click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForFunction(() => document.querySelector('.navbar-toggler').getAttribute('aria-expanded') === 'false');
    await page.setViewportSize({ width: 390, height: 900 });
    assert.deepEqual(await rotation(), [1, 0, 0, 1]);
    assert.equal(await page.locator('#mobile-navigation').isVisible(), false);
  });
});
for (const width of [390, 1440]) {
  test(`theme control keeps a visible pointer and keyboard focus indicator at ${width}px`, options, async () => {
    await withPage(width, 900, async page => {
      const toggle = page.locator(width === 390 ? '#darkModeToggleMobile' : '#darkModeToggle');
      await toggle.click();
      const style = () => toggle.evaluate(el => { const s = getComputedStyle(el); return { style: s.outlineStyle, width: s.outlineWidth, offset: s.outlineOffset, color: s.outlineColor }; });
      assert.deepEqual(await style(), { style: 'solid', width: '3px', offset: '2px', color: 'rgb(96, 165, 250)' });
      assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
      assert.equal(await toggle.locator('.moon-icon').evaluate(el => getComputedStyle(el).color), 'rgb(203, 213, 225)', 'retain readable moon rather than source low-contrast icon');
      await toggle.press('Space');
      assert.deepEqual(await style(), { style: 'solid', width: '3px', offset: '2px', color: 'rgb(59, 130, 246)' });
      assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    });
  });
}
test('short mobile viewports keep every navigation link reachable inside a scrollable panel', options, async () => {
  await withPage(390, 320, async page => {
    await page.locator('.navbar-toggler').click();
    const menu = page.locator('#mobile-navigation');
    const box = await menu.boundingBox();
    assert.ok(box.y + box.height <= 304, `menu bottom ${box.y + box.height} must leave a 16px gutter`);
    const last = menu.locator('a').last();
    await last.focus();
    await last.scrollIntoViewIfNeeded();
    const link = await last.boundingBox();
    assert.ok(link.y >= box.y && link.y + link.height <= box.y + box.height);
    assert.ok(await menu.evaluate(el => el.scrollTop > 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.keyboard.press('Escape');
    assert.equal(await menu.isVisible(), false);
  });
});
