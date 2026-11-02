import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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
for (const engine of engines) test(`real ${engine}: CSS layers, pseudo backgrounds and unplayed media survive capture -> observe`, { skip: !enabled, timeout: 180000 }, async t => {
  const dir = process.env.CLONER_MEDIA_EVIDENCE_DIR ? path.resolve(process.env.CLONER_MEDIA_EVIDENCE_DIR, engine) : await mkdtemp(path.join(tmpdir(), 'media-pipeline-'));
  if (process.env.CLONER_MEDIA_EVIDENCE_DIR) await mkdir(dir, { recursive: true }); else t.after(() => rm(dir, { recursive: true, force: true }));
  const requests = [];
  const server = createServer((req, res) => {
    requests.push(req.url);
    if (req.url.endsWith('.svg')) { res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="#147d92"/></svg>'); return; }
    if (/\.(mp4|webm|wav)/.test(req.url)) { res.writeHead(404); res.end('declared media intentionally unavailable; playback not tested'); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Asset observation fixture</title><style>
      body{margin:16px;font:16px sans-serif}h1{font-size:24px}#visual{width:240px;height:80px;background-image:linear-gradient(transparent,transparent),url('/small.svg'),url('/shared.svg')}#visual::before{content:'';display:block;width:20px;height:20px;background:url('/badge.svg')}#density{width:80px;height:40px;background-image:image-set(url('/one.svg') 1x,url('/two.svg') 2x)}video{width:200px;height:100px}@media(min-width:500px){#visual{background-image:url('/wide.svg'),url('/shared.svg')}}
      </style></head><body><h1>Backgrounds and media</h1><div id="visual"></div><div id="density"></div><img src="/shared.svg" alt="Shared image"><video id="movie" preload="none" poster="/shared.svg"><source src="/clip.mp4" type="video/mp4"><source src="/alternate.webm" type="video/webm"></video><audio id="sound" preload="none" src="/tone.wav"></audio></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`, capture = path.join(dir, 'capture'), out = path.join(dir, 'report');
    const args = ['--url', origin, '--out', capture, '--browser', engine, '--widths', '320,640', '--height', '600'];
    if (process.env.CAPTURE_TEST_EXECUTABLE_PATH) args.push('--executable-path', process.env.CAPTURE_TEST_EXECUTABLE_PATH);
    const captured = await run('capture.mjs', args); assert.equal(captured.code, 0, captured.stdout + captured.stderr);
    const before = requests.length; const observed = await run('observe.mjs', ['--capture', capture, '--out', out]);
    assert.equal(observed.code, 0, observed.stdout + observed.stderr); assert.equal(requests.length, before, 'offline observer made a network request');
    const ledger = JSON.parse(await readFile(path.join(out, 'assets.json'))), report = JSON.parse(await readFile(path.join(out, 'observation.json')));
    for (const name of ['small.svg', 'wide.svg', 'shared.svg', 'badge.svg', 'one.svg', 'two.svg', 'clip.mp4', 'alternate.webm', 'tone.wav']) assert.ok(ledger.assets.some(a => a.source_url === `${origin}/${name}`), `${engine}: missing ${name}`);
    const shared = ledger.assets.find(a => a.source_url.endsWith('/shared.svg'));
    assert.deepEqual(shared.dimensions, { width: 80, height: 40 });
    for (const role of ['img', 'css-background', 'video-poster']) assert.ok(shared.observations.some(o => o.role === role), `missing shared role ${role}`);
    assert.ok(ledger.assets.find(a => a.source_url.endsWith('/badge.svg')).observations.every(o => o.pseudo === '::before'));
    assert.ok(ledger.assets.every(a => a.rights === 'unknown' && a.local_path === null && a.content_type === null));
    assert.ok(report.assetCoverage.every(c => c.status === 'recorded'));
    const { [engine]: browserType } = await import('playwright');
    const { collectMediaEvidence } = await import('../scripts/lib/media-evidence.mjs');
    const browser = await browserType.launch(process.env.CAPTURE_TEST_EXECUTABLE_PATH ? { executablePath: process.env.CAPTURE_TEST_EXECUTABLE_PATH } : {});
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
      await page.goto(origin); await page.evaluate(collectMediaEvidence);
      assert.ok(await page.evaluate(() => [...document.querySelectorAll('video,audio')].every(m => m.paused && m.currentTime === 0)));
      let external = 0; await page.route(/^https?:/, route => { external++; return route.abort(); });
      await page.goto(pathToFileURL(path.join(out, 'index.html')).href);
      assert.equal(await page.locator('script,iframe,img,video,audio').count(), 0); assert.equal(external, 0);
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: path.join(dir, `report-${width}.png`), fullPage: true });
      }
    } finally { await browser.close(); }
    await writeFile(path.join(dir, 'requests.json'), JSON.stringify(requests, null, 2));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
