import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage } from '../examples/uulab-services/src/render.js';
import { launchDemoBrowser } from './helpers/demo-browser.mjs';

const enabled=Boolean(process.env.CAPTURE_TEST_BUNDLED_BROWSER || process.env.CAPTURE_TEST_EXECUTABLE_PATH || process.env.CLONER_TEST_BROWSER);
const root=path.resolve(fileURLToPath(new URL('../examples/uulab-services/',import.meta.url)));
const options={skip:!enabled,timeout:30000};
let browser,server,origin;
before(async()=>{
  if(!enabled)return;
  server=createServer(async(req,res)=>{
    try {
      const pathname=new URL(req.url,'http://local').pathname;
      if(['/','/home/','/services/'].includes(pathname)) {
        const page=pathname==='/home/'?'home':'services';
        const template=await readFile(path.join(root,page,'index.html'),'utf8');
        res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
        res.end(template.replace(/<!-- uulab:(home|page) -->/,renderPage({page})));return;
      }
      const file=path.resolve(root,pathname.startsWith('/assets/')?'public'+pathname:'.'+pathname);
      if(!file.startsWith(root+path.sep))throw new Error('outside fixture');
      const mime={'.css':'text/css','.js':'text/javascript','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff'};
      const bytes=await readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;browser=await launchDemoBrowser();
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function withPage(width,callback,extra={}){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',...extra});
  try {const page=await context.newPage();await page.goto(origin+'/home/',{waitUntil:'networkidle'});await callback(page,context);} finally {await context.close();}
}
for(const width of [320,390,768,1440])test(`homepage all nine sections and local images render without overflow at ${width}`,options,async()=>{
  await withPage(width,async page=>{
    assert.equal(await page.locator('main > section').count(),9);
    for (const image of await page.locator('img').all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(img => img.complete ? undefined : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; }));
    }
    await page.locator('.home-contact').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
    assert.equal(await page.locator('.home-insights-grid article').count(),6);
    assert.equal(await page.locator('.home-questions-grid article').count(),4);
    assert.ok(await page.locator('.home-contact').innerText().then(t=>t.includes('함께 구체화해보세요')));
  });
});
test('homepage no-JavaScript content and real local service navigation work',options,async()=>{
  await withPage(390,async page=>{
    assert.ok(await page.locator('h1').innerText().then(t=>t.includes('디지털 제품')));
    assert.equal(await page.locator('.navbar-toggler').isVisible(),false);
    await page.locator('.home-hero a[href="/services/"]').click();
    assert.equal(new URL(page.url()).pathname,'/services/');
    assert.equal(await page.locator('h1').innerText(),'서비스');
    await page.locator('.brand').click();assert.equal(new URL(page.url()).pathname,'/home/');
  },{javaScriptEnabled:false});
});
test('mobile menu navigation works both directions with correct active page and Escape focus',options,async()=>{
  await withPage(390,async page=>{
    await page.locator('.navbar-toggler').click();
    assert.equal(await page.locator('#mobile-navigation a[aria-current="page"]').getAttribute('href'),'/home/');
    await page.keyboard.press('Escape');assert.equal(await page.locator('.navbar-toggler').evaluate(e=>e===document.activeElement),true);
    await page.locator('.navbar-toggler').click();await page.locator('#mobile-navigation a[href="/services/"]').click();
    assert.equal(new URL(page.url()).pathname,'/services/');
    await page.locator('.navbar-toggler').click();
    assert.equal(await page.locator('#mobile-navigation a[aria-current="page"]').getAttribute('href'),'/services/');
    await page.locator('#mobile-navigation a[href="/home/"]').click();assert.equal(await page.locator('.navbar-toggler').getAttribute('aria-expanded'),'false');
  });
});
test('theme preference survives page navigation and reload',options,async()=>{
  await withPage(390,async page=>{
    await page.locator('#darkModeToggleMobile').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.locator('.home-hero a[href="/services/"]').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.locator('.brand').click();await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.locator('#darkModeToggleMobile').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  });
});
test('desktop resize restores focus to the homepage current link',options,async()=>{
  await withPage(390,async page=>{
    await page.locator('.navbar-toggler').click();await page.locator('#mobile-navigation a').first().focus();
    await page.setViewportSize({width:1440,height:900});
    await page.waitForFunction(()=>document.activeElement?.matches('.desktop-navigation a[aria-current="page"]'));
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('href')),'/home/');
  });
});
test('home back-to-top is keyboard operable and returns focus to the main content',options,async()=>{
  await withPage(390,async page=>{
    await page.locator('.home-questions').scrollIntoViewIfNeeded();
    const button=page.locator('#backToTopButton');await button.waitFor({state:'visible'});await button.focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>scrollY===0);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'main-content');
  });
});
test('blocked storage does not break menu or theme enhancement',options,async()=>{
  const context=await browser.newContext({viewport:{width:390,height:900}});
  try {
    await context.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}}));
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/home/');
    await page.locator('#darkModeToggleMobile').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.locator('.navbar-toggler').click();assert.equal(await page.locator('#mobile-navigation').isVisible(),true);assert.deepEqual(errors,[]);
  } finally {await context.close();}
});
