import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { renderPage } from '../examples/uulab-services/src/render.js';

// A real authored document with external CSS intentionally delivered late.
// Placeholder images are control-fixture data, not fidelity evidence.
const templates = {
  '/': new URL('../examples/uulab-services/index.html', import.meta.url),
  '/services/': new URL('../examples/uulab-services/services/index.html', import.meta.url),
};
const enabled = Boolean(process.env.CAPTURE_TEST_BUNDLED_BROWSER || process.env.CAPTURE_TEST_EXECUTABLE_PATH);
const engines = process.env.CLONER_CAPTURE_ENGINES?.split(',') ?? ['chromium'];
assert.ok(engines.length && engines.every(name => ['chromium', 'firefox', 'webkit'].includes(name)));
let server, origin;
before(async () => {
  if (!enabled) return;
  const [rootTemplate, servicesTemplate, css, js] = await Promise.all([
    readFile(templates['/'], 'utf8'),
    readFile(templates['/services/'], 'utf8'),
    readFile(new URL('../examples/uulab-services/src/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../examples/uulab-services/src/main.js', import.meta.url), 'utf8'),
  ]);
  const pages = Object.fromEntries([['/', rootTemplate], ['/services/', servicesTemplate]].map(([route, template]) => [route, template.replace('<!-- uulab:page -->', renderPage())]));
  server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    let type = 'image/svg+xml', body = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
    if (Object.hasOwn(pages, pathname)) { type = 'text/html; charset=utf-8'; body = pages[pathname]; }
    else if (pathname.endsWith('.css')) {
      type = 'text/css'; body = pathname === '/src/styles.css' ? css : '';
      await new Promise(resolve => setTimeout(resolve, 120));
    } else if (pathname === '/src/main.js') { type = 'text/javascript'; body = js; }
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

for (const [route, templateUrl] of Object.entries(templates)) test(`${route} scrollbar creation rules are available before any external stylesheet`, async () => {
  const template = await readFile(templateUrl, 'utf8');
  const critical = template.match(/<style\s+id="scrollbar-critical">([\s\S]*?)<\/style>/);
  assert.ok(critical, 'the authored document must define early scrollbar creation rules');
  assert.ok(critical.index < template.search(/<link\b[^>]*rel="stylesheet"/));
  assert.match(critical[1], /::-webkit-scrollbar\s*\{\s*width:\s*6px;/);
});

for (const engine of engines) {
  test(`${engine} scrollbar layout survives delayed stylesheets and fresh document loads`, { skip: !enabled, timeout: 60000 }, async () => {
    const pw = await import('playwright');
    const browser = await pw[engine].launch(engine === 'chromium' && process.env.CAPTURE_TEST_EXECUTABLE_PATH ? { executablePath: process.env.CAPTURE_TEST_EXECUTABLE_PATH } : {});
    try {
      for (const route of Object.keys(templates)) for (const width of [390, 1440]) for (let attempt = 0; attempt < 3; attempt++) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', colorScheme: 'light' });
        try {
          const page = await context.newPage();
          const errors = []; page.on('pageerror', e => errors.push(e.message));
          const response = await page.goto(`${origin}${route}`, { waitUntil: 'load' });
          assert.equal(response.status(), 200);
          const read = () => page.evaluate(() => ({ window: innerWidth, layout: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
          const initial = await read();
          if (engine === 'webkit' && process.platform === 'linux') assert.equal(initial.layout, width - 6, `initial layout at ${route} ${width}, attempt ${attempt}`);
          assert.ok(initial.content <= initial.layout + 1);
          await page.locator('details').first().locator('summary').click();
          await page.locator('details').first().scrollIntoViewIfNeeded();
          assert.deepEqual(await read(), initial, 'FAQ scrolling must not change the scrollbar reservation');
          await page.reload({ waitUntil: 'load' });
          assert.deepEqual(await read(), initial, 'reload must keep the same available width');
          assert.deepEqual(errors, []);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  });
}
