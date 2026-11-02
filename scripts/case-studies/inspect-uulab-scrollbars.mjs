#!/usr/bin/env node
// Read-only observations of the owned case study. Temporary overrides below
// diagnose causality in isolated pages; they are NEVER paired capture evidence.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as playwright from 'playwright';
import { settleResources } from '../lib/settle.mjs';
const out = path.resolve(process.argv[2] || 'artifacts/scrollbar-inspection');
await mkdir(out, { recursive: true });
function inspect() {
  const root = document.documentElement, body = document.body;
  const pick = (style, names) => Object.fromEntries(names.map(name => [name, style?.getPropertyValue(name) || '']));
  const metrics = { windowWidth: innerWidth, windowHeight: innerHeight, clientWidth: root.clientWidth, clientHeight: root.clientHeight, scrollWidth: root.scrollWidth, scrollHeight: root.scrollHeight, bodyWidth: body.scrollWidth, heroWidth: document.querySelector('h1')?.getBoundingClientRect().width ?? null };
  let scrollbar = null, thumb = null, track = null;
  try {
    scrollbar = pick(getComputedStyle(root, '::-webkit-scrollbar'), ['width', 'height', 'display']);
    thumb = pick(getComputedStyle(root, '::-webkit-scrollbar-thumb'), ['background-color', 'border-radius']);
    track = pick(getComputedStyle(root, '::-webkit-scrollbar-track'), ['background-color']);
  } catch { /* Unsupported pseudo-elements are not substituted. */ }
  const rules = [], inaccessibleSheets = [];
  const walk = list => { for (const rule of list) {
    if (rule.selectorText?.includes('scrollbar')) rules.push({ selector: rule.selectorText, declarations: rule.style.cssText });
    if (rule.cssRules) walk(rule.cssRules);
  } };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules); } catch { inaccessibleSheets.push(sheet.href); }
  }
  return { metrics, rootStyle: pick(getComputedStyle(root), ['overflow-x', 'overflow-y', 'scrollbar-width', 'scrollbar-gutter']), scrollbar, thumb, track, rules, inaccessibleSheets };
}
const report = { timestamp: new Date().toISOString(), purpose: 'Scrollbar diagnosis only; interventions are not fidelity evidence.', pairs: [] };
let failed = false;
try {
  for (const engine of ['chromium', 'firefox', 'webkit']) {
    const browser = await playwright[engine].launch({ headless: true });
    try {
      for (const width of [390, 1440]) {
        const pair = { engine, version: browser.version(), width, height: 900, observations: [] }; report.pairs.push(pair);
        for (const [side, url] of [['source', 'https://uulab.co.kr/services/'], ['target', 'http://127.0.0.1:4173/services/']]) {
          const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light', locale: 'en-US', timezoneId: 'UTC' });
          try {
            const page = await context.newPage();
            const response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
            if (!response?.ok()) throw new Error(`${side}: main HTTP response ${response?.status()}`);
            await settleResources(page); await page.waitForTimeout(200);
            const observation = { side, url, original: await page.evaluate(inspect) }; pair.observations.push(observation);
            const theme = page.locator(width < 1024 ? '#darkModeToggleMobile' : '#darkModeToggle');
            await theme.click(); await page.waitForTimeout(200); observation.dark = await page.evaluate(inspect);
            await theme.click(); await page.waitForTimeout(200);
            if (engine === 'webkit') {
              const css = side === 'source' ? '*::-webkit-scrollbar{width:0!important;height:0!important}' : '::-webkit-scrollbar{width:6px!important}::-webkit-scrollbar-track{background:#f9fafb!important}::-webkit-scrollbar-thumb{background:#2563eb!important;border-radius:3px!important}';
              await page.addStyleTag({ content: css }); await page.waitForTimeout(200);
              observation.diagnosticIntervention = { notFidelityEvidence: true, css, result: await page.evaluate(inspect) };
            }
          } catch (error) { failed = true; pair.observations.push({ side, error: error.message }); }
          finally { await context.close(); }
        }
      }
    } finally { await browser.close(); }
  }
} finally {
  report.completedAt = new Date().toISOString(); report.status = failed ? 'failed' : 'completed';
  await writeFile(path.join(out, 'observations.json'), JSON.stringify(report, null, 2) + '\n');
}
if (failed) process.exitCode = 1;
