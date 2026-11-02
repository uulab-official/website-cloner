import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { renderPage } from '../examples/uulab-services/src/render.js';

// Real authored markup/CSS/JS, local non-visual asset placeholders only.
const enabled = Boolean(process.env.CAPTURE_TEST_BUNDLED_BROWSER || process.env.CAPTURE_TEST_EXECUTABLE_PATH);
const options = { skip: !enabled, timeout: 20000 };
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
async function withPage(width, action, extra = {}) {
  const context = await browser.newContext({viewport:{width,height:900},colorScheme:'light',reducedMotion:'reduce',...extra});
  try {
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror', error=>errors.push(error.message));
    await page.goto(`${base}/services/`,{waitUntil:'load'});
    await action(page);
    assert.deepEqual(errors,[]);
  } finally { await context.close(); }
}
async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function scrollTo(page,y) {
  await page.evaluate(y => window.scrollTo({top:y,behavior:'instant'}),y);
  await settle(page);
}
async function visible(page,expected) {
  const box=await page.locator('#navigation').boundingBox();
  assert.ok(box, 'header remains in the accessible DOM');
  assert.ok(expected ? box.y===0 : box.y+box.height<=0, `header y=${box.y}, height=${box.height}; expected ${expected?'visible':'above viewport'}`);
}
for (const width of [390,1440]) {
  test(`header follows down/up scroll without moving page content at ${width}px`, options, async () => {
    await withPage(width, async page => {
      await visible(page,true);
      const height=await page.evaluate(()=>document.documentElement.scrollHeight);
      await scrollTo(page,600);
      await visible(page,false);
      await page.evaluate(()=>window.dispatchEvent(new Event('scroll')));
      await settle(page);
      await visible(page,false); // duplicate scroll event must not reveal it
      await scrollTo(page,590);
      await visible(page,true);
      await scrollTo(page,700);
      await visible(page,false);
      await scrollTo(page,0);
      await visible(page,true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight),height);
    });
  });
  test(`hidden header reappears for keyboard focus and never hides focused controls at ${width}px`, options, async () => {
    await withPage(width, async page => {
      await scrollTo(page,600);
      await visible(page,false);
      const button=page.locator(width===390?'#darkModeToggleMobile':'#darkModeToggle');
      await button.evaluate(el=>el.focus({preventScroll:true}));
      await settle(page);
      await visible(page,true);
      assert.equal(await page.evaluate(()=>scrollY),600);
      await scrollTo(page,800);
      await visible(page,true);
      await button.press('Space');
      assert.equal(await button.getAttribute('aria-pressed'),'true');
      await button.evaluate(el=>el.blur());
      await scrollTo(page,900);
      await visible(page,false);
    });
  });
}
test('open mobile menu stays reachable during scrolling and Escape restores visible focus', options, async () => {
  await withPage(390, async page => {
    const toggle=page.locator('.navbar-toggler');
    await toggle.click();
    await toggle.evaluate(el=>el.blur());
    await scrollTo(page,600);
    await visible(page,true);
    assert.equal(await page.locator('#mobile-navigation').isVisible(),true);
    await page.keyboard.press('Escape');
    await visible(page,true);
    assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  });
});
test('FAQ click hides the scrolled header without removing keyboard focus visibility', options, async () => {
  await withPage(390, async page => {
    const summary=page.locator('.faq-list details:first-child summary');
    await summary.scrollIntoViewIfNeeded();
    await settle(page);
    await summary.click();
    await settle(page);
    await visible(page,false);
    assert.equal(await page.locator('.faq-list details').first().evaluate(el=>el.open),true);
    await summary.press('Enter');
    assert.equal(await summary.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
    assert.ok(parseFloat(await summary.evaluate(el=>getComputedStyle(el).outlineWidth))>=2);
  });
});
test('static no-JavaScript header stays visible when the document is scrolled', options, async () => {
  await withPage(390, async page => {
    await scrollTo(page,600);
    await visible(page,true);
  }, {javaScriptEnabled:false});
});
