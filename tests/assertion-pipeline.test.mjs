import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAssertion } from '../scripts/lib/action-assertions.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const enabled = process.env.CAPTURE_TEST_BUNDLED_BROWSER === '1' || Boolean(process.env.CAPTURE_TEST_EXECUTABLE_PATH);
const engines = process.env.CAPTURE_TEST_ENGINES?.split(',') ?? ['chromium'];
const json = async f => JSON.parse(await readFile(f, 'utf8'));
function run(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts', script), ...args], { timeout: 180000, killSignal: 'SIGKILL' });
    let stdout = '', stderr = ''; child.stdout.on('data', x => { stdout += x; }); child.stderr.on('data', x => { stderr += x; });
    child.on('error', reject); child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}
async function workspace(t, name) {
  if (process.env.CLONER_ASSERTION_EVIDENCE_DIR) { const d = path.resolve(process.env.CLONER_ASSERTION_EVIDENCE_DIR, name); await mkdir(d, { recursive: true }); return d; }
  const d = await mkdtemp(path.join(tmpdir(), 'cloner-assert-browser-')); t.after(() => rm(d, { recursive: true, force: true })); return d;
}
function fixture(url) {
  const prefix = url.startsWith('/target') ? 'dst' : 'src';
  const broken = url.startsWith('/broken');
  return `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Explicit assertions fixture</title><style>body{margin:0;padding:24px;font:16px/1.5 sans-serif}button{font:inherit}nav{border:1px solid;padding:16px;margin:12px 0}details{margin-top:20px}</style><h1>Observed UI state</h1><button id="${prefix}-toggle" aria-expanded="false" onclick="this.setAttribute('aria-expanded',this.getAttribute('aria-expanded')==='true'?'false':'true');document.querySelector('nav').hidden=this.getAttribute('aria-expanded')!=='true'">Toggle menu</button><nav hidden>Menu content</nav><details><summary>Question</summary><p>Answer</p></details><button id="state" data-state="idle" onclick="${broken ? '' : "setTimeout(()=>this.setAttribute('data-state','ready'),120)"}">Invisible state change</button><p>Attribute changes on the last button do not change its appearance.</p></html>`;
}
for (const browser of engines) {
  test(`assertions ${browser}: portable preparation retains checks through moved-suite comparison`, { skip: !enabled, timeout: 180000 }, async t => {
    const dir = await workspace(t, `${browser}-portable`), requests = [];
    const server = createServer((req, res) => { requests.push(req.url); res.writeHead(200, { 'content-type': 'text/html' }); res.end(fixture(req.url)); });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      const actions = prefix => [
        { type: 'assert', selector: 'nav', check: 'hidden' },
        { type: 'click', selector: `#${prefix}-toggle` },
        { type: 'assert', selector: 'nav', check: 'visible' },
        { type: 'assert', selector: `#${prefix}-toggle`, check: 'attribute', attribute: 'aria-expanded', value: 'true' },
        { type: 'click', selector: `#${prefix}-toggle` },
        { type: 'assert', selector: 'nav', check: 'hidden' },
        { type: 'click', selector: 'summary' },
        { type: 'assert', selector: 'details', check: 'attribute', attribute: 'open', value: '' },
      ];
      for (const prefix of ['src', 'dst']) await writeFile(path.join(dir, `${prefix}.json`), JSON.stringify(actions(prefix)));
      await writeFile(path.join(dir, 'input.json'), JSON.stringify({ schemaVersion: 1, sourceOrigin: origin, targetOrigin: origin, defaults: { widths: [320], height: 480 }, cases: [{ id: 'ui', path: '/source', targetPath: '/target', sourceActions: 'src.json', targetActions: 'dst.json' }] }));
      const engine = ['--browser', browser]; if (process.env.CAPTURE_TEST_EXECUTABLE_PATH) engine.push('--executable-path', process.env.CAPTURE_TEST_EXECUTABLE_PATH);
      const prepared = await run('prepare-suite.mjs', ['--manifest', path.join(dir, 'input.json'), '--out', path.join(dir, 'prepared'), ...engine]);
      assert.equal(prepared.code, 0, prepared.stdout + prepared.stderr); assert.ok(!requests.includes('/target'));
      await rename(path.join(dir, 'prepared'), path.join(dir, 'moved'));
      await writeFile(path.join(dir, 'src.json'), '[]'); await writeFile(path.join(dir, 'dst.json'), '[]');
      const compared = await run('verify-suite.mjs', ['--manifest', path.join(dir, 'moved/suite.json'), '--out', path.join(dir, 'comparison'), ...engine]);
      assert.equal(compared.code, 0, compared.stdout + compared.stderr);
      for (const [side, prefix] of [['source', 'src'], ['target', 'dst']]) {
        const p = await json(path.join(dir, `comparison/cases/ui/${side}/320x480/page.json`));
        assert.equal(p.actions.length, 8); assert.equal(p.actions.filter(a => a.type === 'assert').length, 5);
        assert.ok(p.actions.every(a => a.status === 'completed'));
        assert.ok(p.actions.filter(a => a.type === 'assert').every(a => a.assertion.status === 'passed' && a.assertion.observed.count === 1));
        assert.equal(p.actions[3].selector, `#${prefix}-toggle`); assert.equal(p.actions[7].value, '');
      }
      await writeFile(path.join(dir, 'execution.log'), prepared.stdout + compared.stdout);
    } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
  });
  test(`assertions ${browser}: visually identical broken target fails only when state is checked`, { skip: !enabled, timeout: 180000 }, async t => {
    const dir = await workspace(t, `${browser}-invisible-bug`);
    const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(fixture(req.url)); });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    try {
      const origin = `http://127.0.0.1:${server.address().port}`, actions = path.join(dir, 'actions.json');
      const engine = ['--browser', browser]; if (process.env.CAPTURE_TEST_EXECUTABLE_PATH) engine.push('--executable-path', process.env.CAPTURE_TEST_EXECUTABLE_PATH);
      const args = ['--source', `${origin}/source`, '--target', `${origin}/broken`, '--widths', '320', '--height', '480', '--source-actions', actions, '--target-actions', actions, ...engine];
      await writeFile(actions, JSON.stringify([{ type: 'click', selector: '#state' }]));
      const before = await run('verify.mjs', [...args, '--out', path.join(dir, 'click-only')]);
      assert.equal(before.code, 0, before.stdout + before.stderr);
      const baseline = await json(path.join(dir, 'click-only/verification.json'));
      assert.equal(baseline.rows[0].changedPixelRatio, 0); assert.equal(baseline.rows[0].exactPixels.changedPixels, 0);
      await writeFile(actions, JSON.stringify([{ type: 'click', selector: '#state' }, { type: 'assert', selector: '#state', check: 'attribute', attribute: 'data-state', value: 'ready', timeoutMs: 500 }]));
      const after = await run('verify.mjs', [...args, '--out', path.join(dir, 'asserted')]);
      assert.equal(after.code, 1, after.stdout + after.stderr);
      const p = await json(path.join(dir, 'asserted/target/320x480/page.json'));
      assert.equal(p.actions[0].status, 'completed'); assert.equal(p.actions[1].status, 'failed');
      assert.equal(p.actions[1].assertion.observed.value, 'idle');
      const report = await json(path.join(dir, 'asserted/verification.json'));
      assert.equal(report.status, 'failed'); assert.equal(report.rows[0].comparable, false); assert.equal(report.functionalParity, 'not_verified');
      await writeFile(path.join(dir, 'execution.log'), before.stdout + after.stdout);
    } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
  });
  test(`assertions ${browser}: read-only retries reject absent, ambiguous and truncated evidence`, { skip: !enabled, timeout: 30000 }, async t => {
    const { [browser]: engine } = await import('playwright');
    const instance = await engine.launch({ headless: true, ...(process.env.CAPTURE_TEST_EXECUTABLE_PATH ? { executablePath: process.env.CAPTURE_TEST_EXECUTABLE_PATH } : {}) });
    try {
      const page = await instance.newPage();
      await page.setContent('<button id="later" data-state="idle">Later</button><div id="hidden" hidden>Hidden</div><i class="dup">one</i><i class="dup">two</i>');
      await page.evaluate(() => { setTimeout(() => document.querySelector('#later').setAttribute('data-state', 'ready'), 150); });
      const delayed = await runAssertion(page, { type: 'assert', selector: '#later', check: 'attribute', attribute: 'data-state', value: 'ready', timeoutMs: 1500 });
      assert.equal(delayed.status, 'passed'); assert.equal(delayed.observed.value, 'ready');
      const hidden = await runAssertion(page, { type: 'assert', selector: '#hidden', check: 'hidden', timeoutMs: 100 }); assert.equal(hidden.status, 'passed');
      const missing = await runAssertion(page, { type: 'assert', selector: '#missing', check: 'hidden', timeoutMs: 100 }); assert.equal(missing.status, 'failed'); assert.equal(missing.observed.count, 0);
      const duplicate = await runAssertion(page, { type: 'assert', selector: '.dup', check: 'visible', timeoutMs: 100 }); assert.equal(duplicate.status, 'failed'); assert.equal(duplicate.observed.count, 2);
      await page.locator('#later').evaluate(el => el.setAttribute('data-state', 'x'.repeat(2001)));
      const truncated = await runAssertion(page, { type: 'assert', selector: '#later', check: 'attribute', attribute: 'data-state', value: 'x'.repeat(2000), timeoutMs: 100 });
      assert.equal(truncated.status, 'failed'); assert.equal(truncated.observed.truncated, true);
      assert.equal(await page.locator('#later').getAttribute('data-state'), 'x'.repeat(2001), 'assertion never mutates the element');
      assert.equal(await page.evaluate(() => scrollY), 0);
      const dir = await workspace(t, `${browser}-runtime`); await writeFile(path.join(dir, 'observed.json'), JSON.stringify({ browser, version: instance.version(), delayed, hidden, missing, duplicate, truncated }, null, 2));
    } finally { await instance.close(); }
  });
}
