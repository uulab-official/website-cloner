import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
function html(target) {
  const id = target ? 'rebuilt-menu' : 'menu', faq = target ? 'rebuilt-faq' : 'faq';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>State preparation fixture</title><style>body{margin:0;font:16px/1.5 sans-serif;background:white;color:#17202c}main{padding:24px;background:inherit}h1{font-size:30px}button,summary{font:inherit;cursor:pointer}nav{padding:20px;border:1px solid}details{margin-top:850px;padding:20px;border:1px solid}footer{height:250px}@media(prefers-color-scheme:dark){body{background:#18202d;color:#eee}}@media(max-width:400px){h1{font-size:24px}}</style><main><h1>State preparation fixture</h1><p>Controlled local test, not a live-site clone.</p><button id="${id}" type="button" onclick="document.querySelector('nav').hidden=false">Open menu</button><nav hidden><p>Menu is open</p><a href="/target">Do not follow during preparation</a></nav><details id="${faq}"><summary>Question</summary><p>FAQ answer visible</p></details><footer>Footer</footer></main></html>`;
}
for (const browser of engines) for (const invalid of [false, true]) {
  test(`state preparation ${browser}: ${invalid ? 'missing selector remains failed' : 'portable actions survive preparation and paired verification'}`, { skip: !enabled, timeout: 240000 }, async t => {
    const name = `${browser}-${invalid ? 'missing-selector' : 'states'}`;
    let dir;
    if (process.env.CLONER_STATE_EVIDENCE_DIR) { const parent = path.resolve(process.env.CLONER_STATE_EVIDENCE_DIR); await mkdir(parent, { recursive: true }); dir = path.join(parent, name); await mkdir(dir); }
    else { dir = await mkdtemp(path.join(tmpdir(), 'cloner-state-pipeline-')); t.after(() => rm(dir, { recursive: true, force: true })); }
    const requests = [], server = createServer((req, res) => { requests.push(req.url); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html(req.url.startsWith('/target'))); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const origin = `http://127.0.0.1:${server.address().port}`, out = path.join(dir, 'prepared');
      const actions = path.join(dir, 'input.json'), targetActions = path.join(dir, 'target-input.json');
      const sourceList = [{ type: 'click', selector: invalid ? '#missing' : '#menu' }, { type: 'click', selector: '#faq summary' }, { type: 'scroll', selector: '#faq' }];
      const targetList = [{ type: 'click', selector: '#rebuilt-menu' }, { type: 'click', selector: '#rebuilt-faq summary' }, { type: 'scroll', selector: '#rebuilt-faq' }];
      await writeFile(actions, JSON.stringify(sourceList)); await writeFile(targetActions, JSON.stringify(targetList));
      const engine = ['--browser', browser]; if (process.env.CAPTURE_TEST_EXECUTABLE_PATH) engine.push('--executable-path', process.env.CAPTURE_TEST_EXECUTABLE_PATH);
      const args = ['--source', `${origin}/source`, '--target', `${origin}/target`, '--out', out, '--widths', invalid ? '320' : '320,640', '--height', '480', '--actions', actions, '--target-actions', targetActions, '--state', 'menu-faq', '--scheme', 'dark', '--keep-scroll', ...engine];
      const dry = await run('prepare-clone.mjs', [...args, '--dry-run']); assert.equal(dry.code, 0, dry.stderr); assert.equal(requests.length, 0);
      const result = await run('prepare-clone.mjs', args); assert.equal(result.code, invalid ? 1 : 0, result.stdout + result.stderr); assert.equal(result.signal, null);
      const record = await json(path.join(out, 'preparation.json')); assert.equal(record.status, invalid ? 'failed' : 'prepared'); assert.equal(record.targetVisited, false);
      assert.equal(record.captureState.targetActionsVerified, false); assert.ok(!requests.includes('/target'));
      await writeFile(path.join(dir, 'preparation-requests.json'), JSON.stringify(requests, null, 2));
      if (invalid) { assert.equal(record.stages[1].status, 'failed'); assert.equal(record.stages[2].status, 'not_started'); return; }
      for (const width of [320, 640]) {
        const p = await json(path.join(out, `source/${width}x480/page.json`));
        assert.ok(p.keyElements.some(e => e.tag === 'main' && e.layout.backgroundColor === 'rgb(24, 32, 45)'));
        assert.equal(p.scheme, 'dark'); assert.equal(p.state, 'menu-faq'); assert.equal(p.scrollState.keepScroll, true); assert.ok(p.scrollState.atCapture.y > 0);
        assert.equal(p.actions.length, 3); assert.ok(p.actions.every(a => a.status === 'completed'));
        assert.ok(p.keyElements.some(e => e.text === 'FAQ answer visible')); assert.ok(p.keyElements.some(e => e.text === 'Menu is open'));
      }
      // The later verifier must not depend on caller-owned action files or the original directory.
      await writeFile(actions, '[]'); await writeFile(targetActions, '[]'); const moved = path.join(dir, 'relocated'); await rename(out, moved);
      const compared = await run('verify-suite.mjs', ['--manifest', path.join(moved, 'suite.json'), '--out', path.join(dir, 'comparison'), ...engine]);
      assert.equal(compared.code, 0, compared.stdout + compared.stderr); assert.ok(requests.includes('/target'));
      const sourcePage = await json(path.join(dir, 'comparison/cases/page/source/320x480/page.json'));
      const targetPage = await json(path.join(dir, 'comparison/cases/page/target/320x480/page.json'));
      assert.deepEqual(sourcePage.actions.map(({ type, selector }) => ({ type, selector })), sourceList);
      assert.deepEqual(targetPage.actions.map(({ type, selector }) => ({ type, selector })), targetList);
      await writeFile(path.join(dir, 'verify.stdout.log'), compared.stdout); await writeFile(path.join(dir, 'verify.stderr.log'), compared.stderr);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  });
}
