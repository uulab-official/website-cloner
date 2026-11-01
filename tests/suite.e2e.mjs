import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { normalizeSuite } from '../scripts/lib/suite.mjs';

const cli = fileURLToPath(new URL('../scripts/verify-suite.mjs', import.meta.url));
async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'clone-suite-e2e-'));
  const server = createServer((request, response) => {
    if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    response.writeHead(request.url === '/missing' ? 404 : 200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Local fixture</title><style>body{margin:0;padding:16px;font:16px Arial}button{font:inherit}#panel{padding:12px}</style><h1>${request.url === '/different' ? 'Changed page' : 'Fixture page'}</h1><button id="menu" type="button" onclick="document.getElementById('panel').hidden=false">Open menu</button><div id="panel" hidden>Expanded panel</div></html>`);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  return { directory, origin: `http://127.0.0.1:${server.address().port}` };
}
async function execute(directory, cases) {
  const config = path.join(directory, 'suite.json'); const out = path.join(directory, 'run');
  await writeFile(config, JSON.stringify({ schemaVersion: 1, name: 'Real local browser suite', defaults: { widths: [320], height: 240, maxDiffRatio: 0 }, cases }));
  const child = spawn(process.execPath, [cli, '--config', config, '--out', out], { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', chunk => { log = (log + chunk).slice(-24000); });
  child.stderr.on('data', chunk => { log = (log + chunk).slice(-24000); });
  const [exitCode] = await once(child, 'close');
  return { exitCode, log, out, report: JSON.parse(await readFile(path.join(out, 'suite.json'), 'utf8')) };
}

test('real capture/compare subprocesses verify multiple routes and inline menu actions', async t => {
  const { directory, origin } = await fixture(t);
  const action = [{ type: 'click', selector: '#menu' }];
  const result = await execute(directory, [
    { id: 'default', source: `${origin}/same`, target: `${origin}/same` },
    { id: 'menu', source: `${origin}/menu`, target: `${origin}/menu`, sourceActions: action, targetActions: action },
  ]);
  assert.equal(result.exitCode, 0, result.log); assert.equal(result.report.status, 'completed');
  assert.equal(result.report.summary.completed, 2); assert.equal(result.report.summary.visualGates.passed, 2);
  assert.equal(result.report.summary.warnings, 0); assert.equal(result.report.functionalParity, 'not_verified');
  for (const item of result.report.cases) { assert.equal(item.rows[0].changedPixelRatio, 0); assert.ok((await stat(path.join(result.out, 'cases', item.id, 'evidence', 'index.html'))).size > 0); }
  const base = await readFile(path.join(result.out, 'cases/default/evidence/source/320x240/viewport.png'));
  const opened = await readFile(path.join(result.out, 'cases/menu/evidence/source/320x240/viewport.png'));
  assert.equal(base.equals(opened), false, 'menu action must change rendered evidence');
});

test('HTTP failure and pixel-gate failure retain diagnostics while later cases still run', async t => {
  const { directory, origin } = await fixture(t);
  const result = await execute(directory, [
    { id: 'http-error', source: `${origin}/missing`, target: `${origin}/same` },
    { id: 'visual-error', source: `${origin}/same`, target: `${origin}/different` },
    { id: 'recovery', source: `${origin}/same`, target: `${origin}/same` },
  ]);
  assert.equal(result.exitCode, 1, result.log); assert.equal(result.report.status, 'failed');
  assert.deepEqual(result.report.cases.map(item => item.status), ['failed', 'failed', 'completed']);
  assert.equal(result.report.cases[0].rows[0].visualGate, 'not_evaluated');
  assert.equal(result.report.cases[1].rows[0].visualGate, 'failed');
  assert.equal(result.report.cases[2].rows[0].visualGate, 'passed');
  assert.equal(result.report.summary.completed, 1); assert.equal(result.report.summary.failed, 2);
  assert.equal(result.report.summary.pending, 0);
  assert.ok((await stat(path.join(result.out, 'cases/recovery/evidence/comparisons/320x240/side-by-side.png'))).size > 0);
  assert.match(await readFile(path.join(result.out, 'index.html'), 'utf8'), /http-error/);
});

// Small authored fixtures model the observed control boundary, not a copy of
// the production page. Live evidence remains the source for source-site parity.
for (const state of ['dark', 'faq']) {
  test(`bundled ${state} actions reach the intended state on both layouts and selector maps`, async () => {
    const manifest = JSON.parse(await readFile(new URL('../docs/case-studies/uulab-services/verification-suite.json', import.meta.url), 'utf8'));
    const item = normalizeSuite(manifest, { only: [state] }).cases[0];
    const browser = await chromium.launch({ headless: true });
    try {
      for (const width of item.widths) {
        for (const side of ['source', 'target']) {
          const page = await browser.newPage({ viewport: { width, height: item.height } });
          try {
            const heading = side === 'target' ? ' id="faq-title"' : '';
            const wrapper = side === 'target' ? 'class="faq-list"' : '';
            await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>#darkModeToggleMobile{display:none}@media(max-width:767px){#darkModeToggle{display:none}#darkModeToggleMobile{display:block}}</style><button id="darkModeToggle" onclick="document.documentElement.classList.add('dark')">Theme</button><button id="darkModeToggleMobile" onclick="document.documentElement.classList.add('dark')">Theme</button><h2${heading}>상담 전에 자주 확인하는 내용</h2><div ${wrapper}><details><summary>아이디어만 있어도 상담할 수 있나요?</summary><p>Visible answer</p></details></div></html>`);
            for (const action of item[`${side}Actions`]) {
              const locator = page.locator(action.selector);
              if (action.type === 'click') await locator.click({ timeout: 2000 });
              else await locator.scrollIntoViewIfNeeded({ timeout: 2000 });
            }
            if (state === 'dark') assert.equal(await page.locator('html').evaluate(el => el.classList.contains('dark')), true, `${side} ${width}`);
            else assert.equal(await page.locator('details').evaluate(el => el.open), true, `${side} ${width}`);
          } finally { await page.close(); }
        }
      }
    } finally { await browser.close(); }
  });
}
