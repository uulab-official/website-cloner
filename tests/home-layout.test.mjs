import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderPage } from '../examples/uulab-services/src/render.js';
import { launchDemoBrowser } from './helpers/demo-browser.mjs';

// Computed-style contracts only. HTTP navigation and production captures are
// checked separately; setContent is not a substitute for those checks.
const enabled = Boolean(process.env.CAPTURE_TEST_BUNDLED_BROWSER || process.env.CAPTURE_TEST_EXECUTABLE_PATH || process.env.CLONER_TEST_BROWSER);
let browser;
before(async () => { if (enabled) browser = await launchDemoBrowser(); });
after(async () => { await browser?.close(); });
for (const width of [390, 1440]) test(`home observed text rhythm and CTA spacing at ${width}`, { skip: !enabled }, async () => {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  try {
    const css = (await Promise.all(['styles.css', 'home.css'].map(file => readFile(new URL(`../examples/uulab-services/src/${file}`, import.meta.url), 'utf8')))).join('\n');
    const page = await context.newPage();
    await page.setContent(`<!doctype html><html lang="ko"><head><style>${css}</style></head><body>${renderPage({ page: 'home' })}</body></html>`);
    const measured = await page.evaluate(() => {
      const style = selector => getComputedStyle(document.querySelector(selector));
      return { labelDisplay: style('.home-stats span').display, introLine: style('.home-intro-copy p').lineHeight, leadLine: style('.home-introduction > p:last-child').lineHeight, buttonFont: style('.home-solutions-grid + .home-more a').fontSize, buttonLine: style('.home-solutions-grid + .home-more a').lineHeight, arrowCount: document.querySelectorAll('.home-question-links .home-link-arrow').length, gridColumns: style('.home-intro-grid').gridTemplateColumns.split(' ').length };
    });
    assert.equal(measured.labelDisplay, 'block');
    assert.equal(measured.introLine, width === 1440 ? '28px' : '32px');
    assert.equal(measured.leadLine, width === 1440 ? '28px' : '32px');
    assert.equal(measured.buttonFont, '16px'); assert.equal(measured.buttonLine, '25.6px');
    assert.equal(measured.arrowCount, 2);
    assert.equal(measured.gridColumns, width === 1440 ? 2 : 1);
    assert.equal(await page.locator('.home-question-links .home-link-arrow').first().evaluate(e => getComputedStyle(e).marginLeft), '8px');
  } finally { await context.close(); }
});
