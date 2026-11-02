import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const enabled = process.env.CAPTURE_TEST_BUNDLED_BROWSER === '1' || Boolean(process.env.CAPTURE_TEST_EXECUTABLE_PATH);
const engines = process.env.CAPTURE_TEST_ENGINES?.split(',') ?? ['chromium'];
function run(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts', script), ...args], { timeout: 120000, killSignal: 'SIGKILL' });
    let stdout = '', stderr = '';
    child.stdout.on('data', part => { stdout += part; }); child.stderr.on('data', part => { stderr += part; });
    child.on('error', reject); child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}
async function workspace(t, name) {
  if (process.env.CLONER_INIT_EVIDENCE_DIR) {
    const parent = path.resolve(process.env.CLONER_INIT_EVIDENCE_DIR);
    await mkdir(parent, { recursive: true });
    const dir = path.join(parent, name); await mkdir(dir); return dir;
  }
  const dir = await mkdtemp(path.join(tmpdir(), 'cloner-init-pipeline-'));
  t.after(() => rm(dir, { recursive: true, force: true })); return dir;
}
for (const browser of engines) {
  for (const failure of [false, true]) {
    test(`generated project completes the real ${browser} pipeline with source HTTP ${failure ? 503 : 200}`, { skip: !enabled, timeout: 180000 }, async t => {
      const dir = await workspace(t, `${browser}-${failure ? 'http-error' : 'matching'}`);
      const requests = [];
      const server = createServer((req, res) => {
        requests.push(req.url);
        res.writeHead(failure && req.url.startsWith('/original') ? 503 : 200, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<!doctype html><html><head><meta charset="utf-8"><title>Local clone fixture</title><style>body{margin:24px;font:16px sans-serif}h1{font-size:24px}section{padding:16px;border:1px solid #bbb}</style></head><body><h1>Local clone fixture</h1><section>Controlled source and target page</section></body></html>');
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      try {
        const origin = `http://127.0.0.1:${server.address().port}`, project = path.join(dir, 'project'), out = path.join(project, 'evidence', 'run-001');
        const initialized = await run('init.mjs', ['--source', `${origin}/original?state=default`, '--target', `${origin}/rebuilt?state=default`, '--out', project, '--widths', failure ? '320' : '320,640', '--height', '240']);
        assert.equal(initialized.code, 0, initialized.stderr); assert.equal(requests.length, 0, 'init must stay offline');
        const args = ['--manifest', path.join(project, 'suite.json'), '--out', out, '--browser', browser];
        if (process.env.CAPTURE_TEST_EXECUTABLE_PATH) args.push('--executable-path', process.env.CAPTURE_TEST_EXECUTABLE_PATH);
        const result = await run('verify-suite.mjs', args);
        assert.equal(result.code, failure ? 1 : 0, result.stdout + result.stderr); assert.equal(result.signal, null);
        const suite = JSON.parse(await readFile(path.join(out, 'suite.json'), 'utf8'));
        const paired = JSON.parse(await readFile(path.join(out, 'cases/page/verification.json'), 'utf8'));
        assert.equal(suite.browser, browser); assert.equal(paired.browser, browser);
        assert.equal(suite.status, failure ? 'failed' : 'completed');
        assert.equal(paired.functionalParity, 'not_verified');
        if (failure) {
          assert.equal(suite.summary.failed, 1);
          assert.equal(paired.rows[0].comparable, false);
          await assert.rejects(stat(path.join(out, 'cases/page/comparisons/320x240/report.json')));
        } else {
          assert.equal(suite.summary.completed, 1); assert.equal(paired.rows.length, 2);
          for (const row of paired.rows) {
            assert.equal(row.exactPixels.identical, true); assert.equal(row.visualGate, 'not_requested');
            assert.equal(row.browser, browser); assert.ok(row.browserVersion);
            assert.ok((await stat(path.join(out, `cases/page/comparisons/${row.width}x240/side-by-side.png`))).size > 0);
          }
        }
        assert.ok(requests.some(url => url.startsWith('/original?')));
        assert.ok(requests.some(url => url.startsWith('/rebuilt?')));
        assert.match(await readFile(path.join(project, 'report.md'), 'utf8'), /not_verified/, 'a fixture run must not rewrite the authored progress report');
      } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    });
  }
}
