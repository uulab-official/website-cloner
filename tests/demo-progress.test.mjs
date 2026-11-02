import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { renderPage } from '../examples/uulab-services/src/render.js';

// Real authored markup/CSS/JS over local HTTP. Placeholder images are not
// visual evidence; full production assets are checked by the demo/live jobs.
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
async function withPage(width, action, extra = {}, init) {
  const context = await browser.newContext({viewport:{width,height:900},colorScheme:'light',reducedMotion:'reduce',...extra});
  try {
    if (init) await context.addInitScript(init);
    const page=await context.newPage(), errors=[];
    page.on('pageerror', error=>errors.push(error.message));
    await page.goto(`${base}/services/`,{waitUntil:'load'});
    await action(page);
    assert.deepEqual(errors,[]);
  } finally { await context.close(); }
}
async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function scroll(page,y) {
  await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),y);
  await settle(page);
}
async function progress(page) {
  assert.equal(await page.locator('[data-scroll-progress]').count(),1,'a single authored progress indicator must exist');
  return page.locator('[data-scroll-progress]').evaluate(el=>{
    const s=getComputedStyle(el), b=el.getBoundingClientRect();
    const range=Math.max(0,document.documentElement.scrollHeight-innerHeight);
    const ratio=range>0?Math.max(0,Math.min(1,scrollY/range)):0;
    return {actual:b.width,expected:innerWidth*ratio,x:b.x,y:b.y,height:b.height,position:s.position,pointerEvents:s.pointerEvents,transition:s.transitionDuration,hidden:el.hidden,ariaHidden:el.getAttribute('aria-hidden')};
  });
}
async function assertProgress(page) {
  const p=await progress(page);
  assert.ok(Number.isFinite(p.actual));
  assert.ok(Math.abs(p.actual-p.expected)<0.05,`progress ${p.actual}px, expected ${p.expected}px`);
  return p;
}
for (const width of [390,1440]) {
  test(`progress tracks top, middle and bottom without moving content at ${width}px`, options, async () => {
    await withPage(width,async page=>{
      const height=await page.evaluate(()=>document.documentElement.scrollHeight);
      const start=await assertProgress(page);
      assert.equal(start.actual,0); assert.equal(start.position,'fixed'); assert.equal(start.y,0); assert.equal(start.x,0); assert.equal(start.height,4);
      assert.equal(start.ariaHidden,'true'); assert.equal(start.pointerEvents,'none'); assert.equal(start.hidden,false);
      await scroll(page,Math.floor((height-900)/2)); await assertProgress(page);
      await scroll(page,height); const end=await assertProgress(page); assert.equal(end.actual,width);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight),height);
    });
  });
}
test('progress recalculates after viewport resizing without another user scroll', options, async()=>{
  await withPage(390,async page=>{
    await progress(page); await scroll(page,1500);
    await page.setViewportSize({width:768,height:740}); await settle(page); await assertProgress(page);
  });
});
test('progress recalculates after FAQ expansion and dynamic content growth', options, async()=>{
  await withPage(390,async page=>{
    await progress(page); await scroll(page,1500);
    await page.evaluate(()=>{document.querySelector('details').open=true;}); await settle(page); await assertProgress(page);
    await page.evaluate(()=>{const extra=document.createElement('div');extra.style.height='1200px';document.body.append(extra);});
    await settle(page); await assertProgress(page);
  });
});
test('a page shorter than the viewport keeps finite zero progress', options, async()=>{
  await withPage(390,async page=>{
    await progress(page);
    await page.evaluate(()=>{document.querySelector('main').remove();document.querySelector('footer').remove();});
    await settle(page); const p=await assertProgress(page); assert.equal(p.actual,0);
  });
});
test('page restoration and reduced motion retain accurate progress', options, async()=>{
  await withPage(390,async page=>{
    await progress(page); await scroll(page,900);
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    await settle(page); const p=await assertProgress(page); assert.equal(p.transition,'0s');
    await page.locator('#backToTopButton').press('Enter'); await settle(page);
    assert.equal(await page.evaluate(()=>scrollY),0); await assertProgress(page);
    assert.equal(await page.locator('#main-content').evaluate(el=>el===document.activeElement),true);
  });
});
test('without ResizeObserver the scroll, resize and FAQ paths still update progress', options, async()=>{
  await withPage(390,async page=>{
    await progress(page); await scroll(page,1000); await assertProgress(page);
    await page.evaluate(()=>{document.querySelector('details').open=true;});
    await page.waitForTimeout(50); await settle(page); await assertProgress(page);
    await page.setViewportSize({width:768,height:800}); await settle(page); await assertProgress(page);
  },{},()=>{delete window.ResizeObserver;});
});
test('without JavaScript progress remains hidden and content remains available', options, async()=>{
  await withPage(390,async page=>{
    assert.equal(await page.locator('[data-scroll-progress]').count(),1);
    assert.equal(await page.locator('[data-scroll-progress]').isVisible(),false);
    assert.equal(await page.locator('main > section').count(),9);
    assert.equal(await page.locator('#backToTopButton').isVisible(),false);
  },{javaScriptEnabled:false});
});
for (const width of [320,390,768,769,1440]) {
  test(`back-to-top uses the observed 24px edge offsets at ${width}px`, options, async()=>{
    await withPage(width,async page=>{
      await scroll(page,300); const button=page.locator('#backToTopButton'); assert.equal(await button.isVisible(),false);
      await scroll(page,301); const box=await button.boundingBox(); assert.ok(box);
      assert.equal(box.width,48);assert.equal(box.height,48);
      assert.equal(width-box.x-box.width,24);assert.equal(900-box.y-box.height,24);
      await button.press('Enter'); await settle(page); assert.equal(await page.evaluate(()=>scrollY),0);
      assert.equal(await page.locator('#main-content').evaluate(el=>el===document.activeElement),true);
    });
  });
}
