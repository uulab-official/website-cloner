#!/usr/bin/env node
/** Read-only observations of the owner's public page. No form submissions. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const out = path.resolve('artifacts/scroll/inspection');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { createdAt: new Date().toISOString(), browser: browser.version(), runs: [] };
async function observe(page, label) {
  await page.waitForTimeout(400);
  return page.evaluate(label => {
    const style = selector => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const s = getComputedStyle(el), b = el.getBoundingClientRect();
      return { x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom,transform:s.transform,display:s.display,visibility:s.visibility,opacity:s.opacity,outline:s.outline,outlineOffset:s.outlineOffset,boxShadow:s.boxShadow,transition:s.transition,focused:el===document.activeElement,focusVisible:el.matches(':focus-visible') };
    };
    return { label, scrollY, documentHeight:document.documentElement.scrollHeight, header:style('#navigation'), summary:style('details:first-of-type summary'), faqOpen:document.querySelector('details:first-of-type')?.open, activeElement:document.activeElement?.tagName };
  }, label);
}
try {
  for (const [side, url] of [['source','https://uulab.co.kr/services/'],['target','http://127.0.0.1:4173/services/']]) {
    for (const width of [390,1440]) {
      const context = await browser.newContext({viewport:{width,height:900},colorScheme:'light',reducedMotion:'reduce',locale:'en-US',timezoneId:'UTC',deviceScaleFactor:1});
      const run = { side, url, width, height:900, observations:[], errors:[] };
      report.runs.push(run);
      try {
        const page = await context.newPage();
        page.on('pageerror', e => run.errors.push(e.message));
        const response = await page.goto(url, {waitUntil:'networkidle',timeout:45000});
        if (!response?.ok()) throw new Error(`Main document HTTP ${response?.status()}`);
        await page.evaluate(() => document.fonts.ready);
        for (const y of [0,50,99,100,101,200,201,600,590,591,0]) {
          await page.evaluate(y => window.scrollTo({top:y,behavior:'instant'}), y);
          run.observations.push(await observe(page,`scroll-${y}`));
        }
        const summary = page.locator('details:first-of-type summary');
        await summary.scrollIntoViewIfNeeded();
        run.observations.push(await observe(page,'faq-scroll'));
        await summary.click();
        run.observations.push(await observe(page,'faq-pointer-open'));
        await page.screenshot({path:path.join(out,`${side}-${width}-faq.png`),animations:'disabled'});
        await summary.press('Enter');
        run.observations.push(await observe(page,'faq-keyboard-close'));
        await page.screenshot({path:path.join(out,`${side}-${width}-keyboard.png`),animations:'disabled'});
        await page.locator(width===390?'#darkModeToggleMobile':'#darkModeToggle').focus();
        run.observations.push(await observe(page,'header-focus'));
        await page.evaluate(() => window.scrollBy({top:200,behavior:'instant'}));
        run.observations.push(await observe(page,'header-focused-scroll'));
      } catch (error) { run.errors.push(error.message); process.exitCode=1; }
      finally { await context.close(); await writeFile(path.join(out,'observations.json'),JSON.stringify(report,null,2)+'\n'); }
    }
  }
} finally { await browser.close(); }
