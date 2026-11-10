import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderPage } from '../examples/uulab-services/src/render.js';
import { launchDemoBrowser } from './helpers/demo-browser.mjs';

// Dated computed-color contracts. Real toggle/navigation and production source
// comparisons run separately; setContent does not establish visual parity.
const enabled = Boolean(process.env.CAPTURE_TEST_BUNDLED_BROWSER || process.env.CAPTURE_TEST_EXECUTABLE_PATH || process.env.CLONER_TEST_BROWSER);
const contract = JSON.parse(await readFile(new URL('./fixtures/home-dark-styles.json', import.meta.url), 'utf8'));
const sharedCss = await readFile(new URL('../examples/uulab-services/src/styles.css', import.meta.url), 'utf8');
const homeCss = await readFile(new URL('../examples/uulab-services/src/home.css', import.meta.url), 'utf8');
let browser;
before(async () => { if (enabled) browser = await launchDemoBrowser(); });
after(async () => { await browser?.close(); });
async function withPage(width, kind, dark, callback, css = sharedCss + '\n' + homeCss) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.setContent(`<!doctype html><html lang="ko" class="${dark ? 'dark' : ''}"><head><style>${css}</style></head><body>${renderPage({ page: kind })}</body></html>`);
    await callback(page);
  } finally { await context.close(); }
}
const groups = [...new Set(contract.contracts.map(row => row.group))];
for (const width of [390, 1440]) {
  for (const group of groups) test(`home active-dark ${group} uses observed colors at ${width}`, { skip: !enabled }, async () => {
    await withPage(width, 'home', true, async page => {
      const expected = contract.contracts.filter(row => row.group === group);
      const actual = await page.evaluate(rows => rows.map(row => {
        const element = document.querySelector(row.target);
        if (!element) throw new Error(`Contract selector missing: ${row.target}`);
        const style = getComputedStyle(element);
        return { target: row.target, expected: Object.fromEntries(row.properties.map(key => [key, style[key]])) };
      }), expected);
      // Engines may serialize diagonal gradient directions differently. Compare
      // its measured stop values while explicitly retaining its diagonal rule.
      for (const [index, row] of actual.entries()) {
        if (row.expected.backgroundImage) {
          assert.match(row.expected.backgroundImage, /^linear-gradient\((?:to (?:right bottom|bottom right)|135deg),/);
          assert.deepEqual(row.expected.backgroundImage.match(/rgba?\([^)]*\)/g), expected[index].expected.backgroundImage.match(/rgba?\([^)]*\)/g));
          delete row.expected.backgroundImage;
        }
      }
      assert.deepEqual(actual, expected.map(row => ({ target: row.target, expected: Object.fromEntries(Object.entries(row.expected).filter(([key]) => key !== 'backgroundImage')) })));
    });
  });
  test(`home color state returns exactly to light after a dark cycle at ${width}`, { skip: !enabled }, async () => {
    await withPage(width, 'home', false, async page => {
      const read = () => page.evaluate(rows => rows.map(row => {
        const style = getComputedStyle(document.querySelector(row.target));
        return Object.fromEntries(row.properties.map(key => [key, style[key]]));
      }), contract.contracts);
      const original = await read();
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.evaluate(() => document.documentElement.classList.remove('dark'));
      assert.deepEqual(await read(), original);
    });
  });
}
for (const dark of [false, true]) test(`home stylesheet cannot change service-route styles in ${dark ? 'dark' : 'light'}`, { skip: !enabled }, async () => {
  await withPage(390, 'services', dark, async page => {
    const read = () => page.evaluate(() => [...document.querySelectorAll('body, body *')].map(e => {
      const s = getComputedStyle(e);
      return [s.color, s.backgroundColor, s.backgroundImage, s.borderColor, s.padding, s.fontSize];
    }));
    const original = await read();
    await page.addStyleTag({ content: homeCss });
    assert.deepEqual(await read(), original);
  }, sharedCss);
});
