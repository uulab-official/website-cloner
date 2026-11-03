import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rename, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const enabled = process.env.CAPTURE_TEST_BUNDLED_BROWSER === '1' || Boolean(process.env.CAPTURE_TEST_EXECUTABLE_PATH);
const engines = process.env.CAPTURE_TEST_ENGINES?.split(',') ?? ['chromium'];
const json = async file => JSON.parse(await readFile(file, 'utf8'));
function run(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts', script), ...args], { timeout: 180000, killSignal: 'SIGKILL' });
    let stdout = '', stderr = ''; child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
    child.on('error', reject); child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}
function html(target, second) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Batch preparation fixture</title><style>body{margin:0;font:16px/1.5 sans-serif;background:white;color:#17202c}main{padding:24px}button{font:inherit}nav{padding:20px;border:1px solid}h1{font-size:28px}@media(prefers-color-scheme:dark){body{background:#18202d;color:#eee}}</style><main><h1>${second ? 'Second source route' : 'First source route'}</h1><p>Controlled local test, not a live-site clone.</p><button id="${target ? 'copy-menu' : 'menu'}" type="button" onclick="document.querySelector('nav').hidden=false">Open menu</button><nav hidden>Menu is open</nav></main></html>`;
}
for (const browser of engines) for (const mode of ['portable', 'partial']) {
  test(`prepare suite ${browser}: ${mode}`, { skip: !enabled, timeout: 240000 }, async t => {
    let dir;
    if (process.env.CLONER_PREPARE_SUITE_EVIDENCE_DIR) {
      const parent = path.resolve(process.env.CLONER_PREPARE_SUITE_EVIDENCE_DIR); await mkdir(parent, { recursive: true }); dir = path.join(parent, `${browser}-${mode}`); await mkdir(dir);
    } else { dir = await mkdtemp(path.join(tmpdir(), 'cloner-batch-pipeline-')); t.after(() => rm(dir, { recursive: true, force: true })); }
    const requests = [];
    const server = createServer((req, res) => { requests.push(req.url); res.writeHead(req.url === '/broken' ? 503 : 200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html(req.url.startsWith('/target'), req.url.includes('two'))); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const origin = `http://127.0.0.1:${server.address().port}`, manifest = path.join(dir, 'input.json'), out = path.join(dir, 'prepared');
      const actions = path.join(dir, 'source-actions.json'), targetActions = path.join(dir, 'target-actions.json');
      await writeFile(actions, '[{"type":"click","selector":"#menu"}]'); await writeFile(targetActions, '[{"type":"click","selector":"#copy-menu"}]');
      const suite = { schemaVersion: 1, sourceOrigin: origin, targetOrigin: origin, defaults: { widths: [320], height: 480 }, cases: mode === 'portable' ? [
        { id: 'first', path: '/one', targetPath: '/target/one', maxDiffRatio: 0.01 },
        { id: 'second-menu', path: '/two?state=menu', targetPath: '/target/two?state=menu', sourceActions: 'source-actions.json', targetActions: 'target-actions.json', state: 'menu-open', scheme: 'dark', widths: [320,640] },
      ] : [{ id: 'broken', path: '/broken' }, { id: 'good', path: '/one', targetPath: '/target/one' }] };
      await writeFile(manifest, JSON.stringify(suite));
      const engine = ['--browser', browser]; if (process.env.CAPTURE_TEST_EXECUTABLE_PATH) engine.push('--executable-path', process.env.CAPTURE_TEST_EXECUTABLE_PATH);
      const args = ['--manifest', manifest, '--out', out, ...engine];
      const dry = await run('prepare-suite.mjs', [...args, '--dry-run']); assert.equal(dry.code, 0, dry.stderr); assert.equal(requests.length, 0); await assert.rejects(stat(out), { code: 'ENOENT' });
      const result = await run('prepare-suite.mjs', args); assert.equal(result.code, mode === 'portable' ? 0 : 1, result.stdout + result.stderr); assert.equal(result.signal, null);
      const record = await json(path.join(out, 'preparation-suite.json'));
      assert.equal(record.targetVisited, false); assert.equal(record.functionalParity, 'not_verified'); assert.ok(!requests.some(r => r.startsWith('/target')));
      await writeFile(path.join(dir, 'source-requests.json'), JSON.stringify(requests)); await writeFile(path.join(dir, 'prepare.log'), result.stdout + result.stderr);
      if (mode === 'partial') {
        assert.equal(record.status, 'failed'); assert.deepEqual(record.cases.map(c=>c.status), ['failed','prepared']); assert.equal(record.summary.prepared, 1);
        const fastOut = path.join(dir, 'fail-fast'); requests.length = 0;
        const fast = await run('prepare-suite.mjs', ['--manifest', manifest, '--out', fastOut, '--fail-fast', ...engine]); assert.equal(fast.code, 1);
        const stopped = await json(path.join(fastOut, 'preparation-suite.json')); assert.deepEqual(stopped.cases.map(c=>c.status), ['failed','not_run']); assert.ok(!requests.includes('/one'));
        assert.equal((await json(path.join(out, 'suite.json'))).cases.length, 2); return;
      }
      assert.equal(record.status, 'prepared'); assert.equal(record.summary.prepared, 2); assert.equal(record.summary.preparedViews, 3);
      const sourcePage = await json(path.join(out, 'cases/second-menu/source/320x480/page.json')); assert.equal(sourcePage.actions[0].selector, '#menu'); assert.equal(sourcePage.actions[0].status, 'completed');
      await writeFile(actions, '[]'); await writeFile(targetActions, '[]'); const moved = path.join(dir, 'relocated'); await rename(out, moved);
      const compared = await run('verify-suite.mjs', ['--manifest', path.join(moved, 'suite.json'), '--out', path.join(dir, 'comparison'), ...engine]);
      assert.equal(compared.code, 0, compared.stdout + compared.stderr); assert.ok(requests.some(r=>r.startsWith('/target')));
      const targetPage = await json(path.join(dir,'comparison/cases/second-menu/target/320x480/page.json')); assert.equal(targetPage.actions[0].selector, '#copy-menu');
      await writeFile(path.join(dir,'verify.log'),compared.stdout+compared.stderr);
      const { [browser]: engineType } = await import('playwright'); const instance = await engineType.launch(process.env.CAPTURE_TEST_EXECUTABLE_PATH ? { executablePath: process.env.CAPTURE_TEST_EXECUTABLE_PATH } : {});
      try {
        const page = await instance.newPage(); const remote = []; page.on('request', r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
        for (const width of [390,1440]) {
          await page.setViewportSize({width,height:900}); await page.goto(pathToFileURL(path.join(moved,'index.html')).href);
          assert.equal(await page.locator('script,iframe,img,video,audio').count(),0);
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
          await page.screenshot({path:path.join(dir,`overview-${width}.png`),fullPage:true});
        }
        await page.getByRole('link',{name:'Case report',exact:true}).first().click(); assert.match(page.url(),/cases\/first\/index\.html$/);
        await page.getByRole('link',{name:'Source observation report',exact:true}).click(); assert.match(page.url(),/observations\/index\.html$/); assert.deepEqual(remote,[]);
      } finally { await instance.close(); }
    } finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
  });
}
