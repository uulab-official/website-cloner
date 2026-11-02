import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const enabled = process.env.CAPTURE_TEST_BUNDLED_BROWSER === '1' || Boolean(process.env.CAPTURE_TEST_EXECUTABLE_PATH);
const engines = process.env.CAPTURE_TEST_ENGINES?.split(',') ?? ['chromium'];
function run(script, args) { return new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [path.join(root, 'scripts', script), ...args], { timeout: 120000, killSignal: 'SIGKILL' }); let stdout = '', stderr = '';
  child.stdout.on('data', p => { stdout += p; }); child.stderr.on('data', p => { stderr += p; }); child.on('error', reject); child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
}); }
for (const engine of engines) for (const failure of [false, true]) test(`real ${engine} capture -> offline observations, source HTTP ${failure ? 503 : 200}`, { skip: !enabled, timeout: 180000 }, async t => {
  const dir = process.env.CLONER_OBSERVE_EVIDENCE_DIR ? path.resolve(process.env.CLONER_OBSERVE_EVIDENCE_DIR, `${engine}-${failure ? 'failed' : 'observed'}`) : await mkdtemp(path.join(tmpdir(), 'observe-pipeline-'));
  if (process.env.CLONER_OBSERVE_EVIDENCE_DIR) await mkdir(dir, { recursive: true }); else t.after(() => rm(dir, { recursive: true, force: true }));
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    if (req.url.endsWith('.png')) { res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="#345"/></svg>'); return; }
    res.writeHead(failure ? 503 : 200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html><head><meta charset="utf-8"><title>&lt;script&gt;untrusted&lt;/script&gt;</title><style>body{margin:16px;font:16px sans-serif}section{display:grid;gap:8px}h1{font-size:24px}@media(min-width:500px){section{grid-template-columns:1fr 1fr}h1{font-size:32px}}</style></head><body><main><h1>Observation fixture</h1><section id="hero"><h2>Source evidence</h2><picture><source media="(min-width:500px)" srcset="/wide.png"><img src="/small.png" alt="Observed variant"></picture><button>Local control</button><a href="/next">Next</a></section></main></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const args = ['--url', `http://127.0.0.1:${server.address().port}/${'a'.repeat(400)}`, '--out', path.join(dir, 'capture'), '--browser', engine, '--widths', '320,640', '--height', '320'];
    if (process.env.CAPTURE_TEST_EXECUTABLE_PATH) args.push('--executable-path', process.env.CAPTURE_TEST_EXECUTABLE_PATH);
    const captured = await run('capture.mjs', args); assert.equal(captured.code, failure ? 1 : 0, captured.stdout + captured.stderr);
    const before = requests, reportDir = path.join(dir, 'report');
    const observed = await run('observe.mjs', ['--capture', path.join(dir, 'capture'), '--out', reportDir]);
    assert.equal(requests, before, 'observe must never access the network'); assert.equal(observed.signal, null);
    assert.equal(observed.code, failure ? 1 : 0, observed.stdout + observed.stderr);
    if (failure) { await assert.rejects(stat(reportDir), { code: 'ENOENT' }); return; }
    const report = JSON.parse(await readFile(path.join(reportDir, 'observation.json'))), ledger = JSON.parse(await readFile(path.join(reportDir, 'assets.json')));
    assert.equal(report.source.browser, engine); assert.equal(report.views.length, 2); assert.equal(ledger.assets.length, 2);
    assert.notEqual(report.views[0].headings[0].typography.fontSize, report.views[1].headings[0].typography.fontSize);
    assert.ok(ledger.assets.every(a => a.content_type === null && a.rights === 'unknown'));
    const { [engine]: browserType } = await import('playwright');
    const browser = await browserType.launch(process.env.CAPTURE_TEST_EXECUTABLE_PATH ? { executablePath: process.env.CAPTURE_TEST_EXECUTABLE_PATH } : {});
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 } }); let external = 0;
      await page.route(/^https?:/, route => { external++; return route.abort(); });
      await page.goto(pathToFileURL(path.join(reportDir, 'index.html')).href);
      assert.equal(await page.locator('script,iframe,img').count(), 0); assert.equal(external, 0);
      assert.ok((await page.locator('body').innerText()).includes('<script>untrusted</script>'));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(dir, 'report-mobile.png'), fullPage: true });
    } finally { await browser.close(); }
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
