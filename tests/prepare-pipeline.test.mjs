import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureBrowserOptions } from '../scripts/lib/browser-check.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const enabled = process.env.CAPTURE_TEST_BUNDLED_BROWSER === '1' || Boolean(process.env.CAPTURE_TEST_EXECUTABLE_PATH);
const engines = process.env.CAPTURE_TEST_ENGINES?.split(',') ?? ['chromium'];
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts/prepare-clone.mjs'), ...args], { timeout: 120000, killSignal: 'SIGKILL' });
    let stdout = '', stderr = ''; child.stdout.on('data', part => { stdout += part; }); child.stderr.on('data', part => { stderr += part; });
    child.on('error', reject); child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}
async function workspace(t, name) {
  if (process.env.CLONER_PREPARE_EVIDENCE_DIR) { const parent = path.resolve(process.env.CLONER_PREPARE_EVIDENCE_DIR); await mkdir(parent, { recursive: true }); const dir = path.join(parent, name); await mkdir(dir); return dir; }
  const dir = await mkdtemp(path.join(tmpdir(), 'cloner-prepare-pipeline-')); t.after(() => rm(dir, { recursive: true, force: true })); return dir;
}
for (const browser of engines) for (const failed of [false, true]) {
  test(`prepare source HTTP ${failed ? 503 : 200} in ${browser} without visiting the target`, { skip: !enabled, timeout: 180000 }, async t => {
    const dir = await workspace(t, `${browser}-${failed ? 'http-error' : 'prepared'}`), requests = [];
    const server = createServer((req, res) => {
      requests.push(req.url); res.writeHead(failed ? 503 : 200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html lang="en"><meta charset="utf-8"><title>Preparation fixture</title><style>body{margin:20px;font:16px sans-serif}h1{font-size:32px}@media(max-width:400px){h1{font-size:24px}}section{padding:24px;border:1px solid #ccc}</style><h1>Source preparation fixture</h1><section><h2>Editable frontend work follows</h2><p>This is a controlled test page, not a live-site clone.</p><a href="/target">Do not follow</a></section></html>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const origin = `http://127.0.0.1:${server.address().port}`, out = path.join(dir, 'project');
      const args = ['--source', `${origin}/source?view=default`, '--target', `${origin}/target`, '--out', out, '--widths', failed ? '320' : '320,640', '--height', '480', '--browser', browser];
      if (process.env.CAPTURE_TEST_EXECUTABLE_PATH) args.push('--executable-path', process.env.CAPTURE_TEST_EXECUTABLE_PATH);
      const dry = await run([...args, '--dry-run']); assert.equal(dry.code, 0, dry.stderr); assert.equal(requests.length, 0); await assert.rejects(stat(out), { code: 'ENOENT' });
      const result = await run(args); assert.equal(result.code, failed ? 1 : 0, result.stdout + result.stderr); assert.equal(result.signal, null);
      const p = JSON.parse(await readFile(path.join(out, 'preparation.json'), 'utf8')); assert.equal(p.status, failed ? 'failed' : 'prepared'); assert.equal(p.browser, browser); assert.equal(p.targetVisited, false); assert.equal(p.implementation, 'not_started'); assert.equal(p.functionalParity, 'not_verified'); assert.equal(p.visualComparison, 'not_performed');
      assert.ok(requests.some(url => url.startsWith('/source?'))); assert.ok(!requests.some(url => url.startsWith('/target')));
      assert.equal(JSON.parse(await readFile(path.join(out, 'assets.json'))).assets.length, 0, 'do not auto-approve candidates');
      assert.match(await readFile(path.join(out, 'report.md'), 'utf8'), /not_verified/);
      if (failed) { assert.equal(p.stages[1].status, 'failed'); await assert.rejects(stat(path.join(out, 'observations')), { code: 'ENOENT' }); }
      else {
        assert.equal(p.summary.views, 2); assert.ok(p.summary.browserVersion); assert.match(p.summary.captureManifestSha256, /^[0-9a-f]{64}$/);
        const obs = JSON.parse(await readFile(path.join(out, 'observations/observation.json'))); assert.equal(obs.source.browser, browser); assert.notEqual(obs.views[0].headings[0].typography.fontSize, obs.views[1].headings[0].typography.fontSize);
        const toolkit = await import('playwright'), options = captureBrowserOptions({ browser, executablePath: process.env.CAPTURE_TEST_EXECUTABLE_PATH });
        const b = await toolkit[browser].launch(options.launchOptions);
        try {
          for (const width of [390, 1440]) {
            const page = await b.newPage({ viewport: { width, height: 900 } }), outbound = [];
            page.on('request', req => { if (/^https?:/.test(req.url())) outbound.push(req.url()); });
            await page.goto(new URL(`file://${out}/index.html`).href);
            assert.equal(await page.locator('h1').innerText(), 'Clone source preparation'); assert.equal(await page.locator('script,iframe,img,video,audio').count(), 0);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.screenshot({ path: path.join(dir, `entry-${width}.png`), fullPage: true });
            await page.getByRole('link', { name: 'Source observation report' }).click();
            assert.match(page.url(), /observations\/index.html$/); assert.equal(outbound.length, 0); await page.close();
          }
        } finally { await b.close(); }
      }
      await writeFile(path.join(dir, 'requests.json'), JSON.stringify(requests, null, 2));
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  });
}
