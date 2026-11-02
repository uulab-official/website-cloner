#!/usr/bin/env node
// Diagnostic local response variants only; never use these as fidelity screenshots.
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { webkit } from 'playwright';
import { settleResources, revealLazyMedia } from '../lib/settle.mjs';
const root = path.resolve('dist/demo');
const out = path.resolve(process.argv[2] || 'artifacts/scrollbar-init');
await mkdir(out, { recursive: true });
const critical = '::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#f9fafb}::-webkit-scrollbar-thumb{background:#2563eb;border-radius:3px}::-webkit-scrollbar-thumb:hover{background:#1d4ed8}';
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('outside demo');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    let bytes = await readFile(file);
    if (path.extname(file) === '.html') {
      const variant = url.searchParams.get('variant');
      const css = variant === 'critical' ? critical : variant === 'reserve' ? 'html{overflow-y:scroll}' : '';
      if (css) bytes = Buffer.from(bytes.toString().replace('<head>', `<head><style data-diagnostic-only>${css}</style>`));
    }
    // Expose CSS arrival ordering consistently without touching the real build.
    if (path.extname(file) === '.css') await new Promise(resolve => setTimeout(resolve, 120));
    res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const browser = await webkit.launch();
const report = { diagnosticOnly: true, codeRevision: process.env.GITHUB_SHA || null, browserVersion: browser.version(), startedAt: new Date().toISOString(), rows: [] };
const dimensions = () => ({ inner: innerWidth, layout: document.documentElement.clientWidth, content: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, scrollbar: getComputedStyle(document.documentElement, '::-webkit-scrollbar').width });
try {
  for (const variant of ['baseline', 'critical', 'reserve']) {
    for (const width of [390, 1440]) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const row = { variant, width, attempt }; report.rows.push(row);
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', colorScheme: 'light', locale: 'en-US', timezoneId: 'UTC' });
        try {
          const page = await context.newPage();
          const response = await page.goto(`http://127.0.0.1:${server.address().port}/services/?variant=${variant}`, { waitUntil: 'load', timeout: 30000 });
          if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
          await settleResources(page); row.initial = await page.evaluate(dimensions);
          await revealLazyMedia(page); await settleResources(page, { includeLazy: true });
          await page.waitForTimeout(200); row.afterScroll = await page.evaluate(dimensions);
          await page.locator('details:first-of-type summary').click();
          await page.locator('details:first-of-type').scrollIntoViewIfNeeded();
          await page.waitForTimeout(200); row.faq = await page.evaluate(dimensions);
          row.allStagesReserveSixPixels = ['initial', 'afterScroll', 'faq'].every(k => row[k].inner - row[k].layout === 6);
          process.stdout.write(JSON.stringify(row) + '\n');
        } catch (error) { row.error = error.message; }
        finally { await context.close(); }
      }
    }
  }
} finally {
  report.completedAt = new Date().toISOString();
  await writeFile(path.join(out, 'probe.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
if (report.rows.some(row => row.error)) process.exitCode = 1;
