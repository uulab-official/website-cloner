import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { launchDemoBrowser } from './helpers/demo-browser.mjs';

let server;
let browser;
let base;
const root = path.resolve('dist/demo');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.json':'application/json' };

before(async () => {
  await stat(path.join(root, 'index.html'));
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let filename = path.resolve(root, `.${pathname}`);
      const relative = path.relative(root, filename);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('outside demo');
      if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
      const data = await readFile(filename);
      response.writeHead(200, {'content-type':mime[path.extname(filename)] || 'application/octet-stream'});
      response.end(data);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  await new Promise((resolve, reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await launchDemoBrowser();
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function pageAt(viewport = {width:1440,height:900}, options = {}) {
  const context = await browser.newContext({viewport,colorScheme:'light',reducedMotion:'reduce',...options});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  page.on('requestfailed',request=>errors.push(`Request failed: ${request.url()}`));
  page.on('response',response=>{if(response.status()>=400) errors.push(`HTTP ${response.status()}: ${response.url()}`);});
  await page.goto(`${base}/services/`,{waitUntil:'networkidle'});
  return {context,page,errors};
}

test('requested route and complete content work without JavaScript', async () => {
  const {context,page,errors} = await pageAt(undefined,{javaScriptEnabled:false});
  try {
    assert.equal(await page.locator('h1').textContent(),'서비스');
    assert.equal(await page.locator('main > section').count(),9);
    assert.equal(await page.locator('details').count(),4);
    assert.match(await page.locator('main').innerText(),/브라우저 AI/);
    assert.match(await page.locator('footer').innerText(),/uulab.official@gmail.com/);
    const contact = await page.getByRole('link',{name:/프로젝트 범위 문의/}).getAttribute('href');
    assert.equal(contact,'https://uulab.co.kr/contact/');
    assert.deepEqual(errors,[]);
  } finally { await context.close(); }
});

test('desktop theme toggles and persists after reload', async () => {
  const {context,page,errors}=await pageAt();
  try {
    const toggle=page.locator('#darkModeToggle');
    await toggle.click();
    assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('dark')),true);
    assert.equal(await toggle.getAttribute('aria-pressed'),'true');
    await page.reload({waitUntil:'networkidle'});
    assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('dark')),true);
    await toggle.press('Space');
    assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('dark')),false);
    assert.deepEqual(errors,[]);
  } finally { await context.close(); }
});

test('mobile menu handles Escape, focus, local link, and resize', async () => {
  const {context,page,errors}=await pageAt({width:390,height:844});
  try {
    const toggle=page.locator('.navbar-toggler');
    const menu=page.locator('#mobile-navigation');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'),'true');
    assert.equal(await menu.isVisible(),true);
    await page.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);
    await toggle.click();
    await menu.getByRole('link',{name:'서비스',exact:true}).click();
    assert.equal(new URL(page.url()).pathname,'/services/');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    await toggle.click();
    await page.setViewportSize({width:1280,height:900});
    await page.waitForFunction(()=>document.querySelector('.navbar-toggler').getAttribute('aria-expanded')==='false');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await menu.isVisible(),false);
    assert.notEqual(await page.locator('body').evaluate(el=>getComputedStyle(el).overflow),'hidden');
    await page.locator('#darkModeToggleMobile').click();
    assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('dark')),true);
    assert.deepEqual(errors,[]);
  } finally { await context.close(); }
});

test('FAQ supports keyboard toggling and back-to-top actually scrolls', async () => {
  const {context,page,errors}=await pageAt({width:390,height:844});
  try {
    const details=page.locator('details').first();
    const summary=details.locator('summary');
    await summary.focus();
    await summary.press('Enter');
    assert.equal(await details.evaluate(el=>el.open),true);
    assert.equal(await details.locator('p').isVisible(),true);
    await summary.press('Enter');
    assert.equal(await details.evaluate(el=>el.open),false);
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    await page.locator('#backToTopButton').waitFor({state:'visible'});
    await page.locator('#backToTopButton').click();
    await page.waitForFunction(()=>scrollY<5);
    assert.deepEqual(errors,[]);
  } finally { await context.close(); }
});

for (const width of [320,390,768,1024,1440]) {
  test(`all content and local assets render without horizontal overflow at ${width}px`, async () => {
    const {context,page,errors}=await pageAt({width,height:900});
    try {
      for (const image of await page.locator('img').all()) await image.scrollIntoViewIfNeeded();
      await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
      const check=await page.evaluate(()=>({
        horizontalOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        missing:[...document.images].filter(image=>!image.naturalWidth).map(image=>image.alt),
        externalAssets:[...document.images].filter(image=>new URL(image.currentSrc).origin!==location.origin).map(image=>image.currentSrc),
        heading:[...document.querySelectorAll('h1')].map(el=>el.textContent),
      }));
      assert.ok(check.horizontalOverflow<=1,`Horizontal overflow ${check.horizontalOverflow}px`);
      assert.deepEqual(check.missing,[]);
      assert.deepEqual(check.externalAssets,[]);
      assert.deepEqual(check.heading,['서비스']);
      assert.deepEqual(errors,[]);
    } finally { await context.close(); }
  });
}

// These are production-implementation views, not source/clone comparisons.
test('production states render as reviewable desktop and mobile evidence', async () => {
  const views=[];
  const evidenceDirectory=process.env.CLONER_DEMO_EVIDENCE_DIR;
  const { mkdir, writeFile }=await import('node:fs/promises');
  if(evidenceDirectory)await mkdir(evidenceDirectory,{recursive:true});
  for(const width of [1440,390]) {
    const {context,page,errors}=await pageAt({width,height:900});
    try {
      await page.evaluate(()=>document.fonts.ready);
      const save=async state=>{
        const filename=`${width}x900-${state}.png`;
        const metadata=await page.evaluate(()=>({scrollX,scrollY,viewport:{width:innerWidth,height:innerHeight},theme:document.documentElement.dataset.theme,faqOpen:document.querySelector('details').open,menuOpen:document.querySelector('.navbar-toggler').getAttribute('aria-expanded')==='true'}));
        const image=await page.screenshot({animations:'disabled',caret:'hide',...(evidenceDirectory?{path:path.join(evidenceDirectory,filename)}:{})});
        assert.ok(image.length>1000,'real production screenshot must not be empty');
        views.push({state,filename,...metadata});
      };
      await save('default');
      if(width===390){await page.locator('.navbar-toggler').click();await save('menu');await page.keyboard.press('Escape');}
      await page.locator(width===390?'#darkModeToggleMobile':'#darkModeToggle').click();
      await save('dark');
      await page.locator(width===390?'#darkModeToggleMobile':'#darkModeToggle').click();
      const summary=page.locator('details').first().locator('summary');
      await summary.click();await summary.scrollIntoViewIfNeeded();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await save('faq');
      assert.deepEqual(errors,[]);
    } finally {await context.close();}
  }
  assert.equal(views.length,7);
  if(evidenceDirectory)await writeFile(path.join(evidenceDirectory,'evidence.json'),JSON.stringify({schemaVersion:1,kind:'production-implementation-only',browser:browser.browserType().name(),version:browser.version(),platform:process.platform,sourceCompared:false,physicalDevice:false,hasTouch:false,reducedMotion:'reduce',timestamp:new Date().toISOString(),views},null,2)+'\n');
});
