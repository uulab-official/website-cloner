#!/usr/bin/env node
/** Read-only observations of the owner's public services page; no submissions. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const out = path.resolve('artifacts/progress/inspection');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { createdAt: new Date().toISOString(), browser: browser.version(), runs: [] };
async function observe(page, label) {
  await page.waitForTimeout(400);
  return page.evaluate(label => {
    const read = el => {
      if (!el) return null;
      const s = getComputedStyle(el), b = el.getBoundingClientRect();
      return { tag:el.tagName, id:el.id, class:el.className, text:el.textContent.trim().slice(0,140), x:b.x, y:b.y, width:b.width, height:b.height,
        position:s.position, top:s.top, right:s.right, bottom:s.bottom, left:s.left, display:s.display, visibility:s.visibility, opacity:s.opacity,
        background:s.background, zIndex:s.zIndex, transform:s.transform, transition:s.transition, padding:s.padding, margin:s.margin, gap:s.gap, lineHeight:s.lineHeight, fontSize:s.fontSize, flexWrap:s.flexWrap };
    };
    const candidates = [...document.querySelectorAll('body *')].filter(el => {
      const s=getComputedStyle(el), b=el.getBoundingClientRect();
      return /progress/i.test(`${el.id} ${el.className}`) || (s.position==='fixed' && b.y===0 && b.height>0 && b.height<=8);
    });
    return { label, scrollY, viewport:{width:innerWidth,height:innerHeight}, documentHeight:document.documentElement.scrollHeight,
      progress:candidates.map(read), backToTop:read(document.querySelector('#backToTopButton')),
      footer:[...document.querySelectorAll('footer, footer div, footer nav, footer p')].map(read) };
  },label);
}
try {
  for (const [side,url] of [['source','https://uulab.co.kr/services/'],['target','http://127.0.0.1:4173/services/']]) {
    for (const width of [390,768,769,1440]) {
      const context=await browser.newContext({viewport:{width,height:900},colorScheme:'light',reducedMotion:'reduce',locale:'en-US',timezoneId:'UTC',deviceScaleFactor:1});
      const run={side,url,width,observations:[],errors:[]}; report.runs.push(run);
      try {
        const page=await context.newPage(); page.on('pageerror',e=>run.errors.push(e.message));
        const response=await page.goto(url,{waitUntil:'networkidle',timeout:45000});
        if (!response?.ok()) throw new Error(`Main document HTTP ${response?.status()}`);
        await page.evaluate(()=>document.fonts.ready);
        for (const y of [0,300,301,'half','bottom']) {
          await page.evaluate(y=>window.scrollTo({top:y==='half'?(document.documentElement.scrollHeight-innerHeight)/2:y==='bottom'?document.documentElement.scrollHeight:y,behavior:'instant'}),y);
          run.observations.push(await observe(page,`scroll-${y}`));
        }
        await page.screenshot({path:path.join(out,`${side}-${width}-bottom.png`),animations:'disabled'});
        if (width===390) {
          const summary=page.locator('details:first-of-type summary'); await summary.click();
          await page.locator('details:first-of-type').scrollIntoViewIfNeeded();
          run.observations.push(await observe(page,'faq-open'));
          await page.screenshot({path:path.join(out,`${side}-${width}-faq.png`),animations:'disabled'});
        }
      } catch (error) { run.errors.push(error.message); process.exitCode=1; }
      finally { await context.close(); await writeFile(path.join(out,'observations.json'),JSON.stringify(report,null,2)+'\n'); }
    }
  }
} finally { await browser.close(); }
