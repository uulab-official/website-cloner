import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as browserOptions from '../scripts/lib/browser-check.mjs';
import { assessPair, renderReport } from '../scripts/lib/verification.mjs';
import { assessCase, runSuite, renderSuiteReport } from '../scripts/lib/suite-runner.mjs';
import { buildVerifyArgs, normalizeSuite } from '../scripts/lib/suite-config.mjs';

const ok = { exitCode: 0, signal: null, error: null };
const page = (browser = 'chromium') => ({
  status: 'completed', viewport: { width: 320, height: 240, deviceScaleFactor: 1 }, state: 'default', scheme: 'light', reducedMotion: 'reduce',
  environment: { browser, browserVersion: 'test-version', headless: true, locale: 'en-US', timezoneId: 'UTC', isMobile: false, hasTouch: false, freshContext: true },
  screenshots: { viewport: 'viewport.png', animations: 'disabled', caret: 'hide' }, consoleErrors: [], pageErrors: [], requestFailures: [], failedResponses: [],
});
const comparison = { status: 'compared', changedPixelRatio: 0, maxDiffRatio: null, passed: null };
const item = () => ({ id: 'home', browser: 'webkit', sourceUrl: 'https://source.test/', targetUrl: 'https://target.test/', widths: [320], height: 240, scheme: 'light', state: 'default', maxDiffRatio: null });
function evidence(i) {
  return { ...i, schemaVersion: 1, tool: 'website-cloner/verify', status: 'completed', errors: [], commands: { source: ok, target: ok }, rows: [{
    width: 320, height: 240, browser: i.browser, browserVersion: 'test-version', status: 'completed', comparable: true, sourceCaptured: true, targetCaptured: true,
    hasComparison: true, changedPixelRatio: 0, visualGate: 'not_requested', errors: [], warnings: [], command: ok,
  }] };
}
async function temp(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'cloner-engine-'));
  t.after(() => rm(dir, { recursive: true, force: true })); return dir;
}
function run(script, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve('scripts', script), ...args], { env, timeout: 180000, killSignal: 'SIGKILL' });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject); child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}
test('capture selection defaults to Chromium without reading demo environment overrides', () => {
  assert.equal(typeof browserOptions.captureBrowserOptions, 'function');
  assert.deepEqual(browserOptions.captureBrowserOptions(), { name: 'chromium', launchOptions: { headless: true } });
});
for (const browser of ['chromium', 'firefox', 'webkit']) {
  test(`capture selection supports ${browser}`, () => {
    assert.equal(typeof browserOptions.captureBrowserOptions, 'function');
    assert.equal(browserOptions.captureBrowserOptions({ browser }).name, browser);
  });
  test(`paired assessment retains requested ${browser} and actual version`, () => {
    const result = assessPair(page(browser), page(browser), comparison, null, browser);
    assert.equal(result.status, 'completed'); assert.equal(result.browser, browser); assert.equal(result.browserVersion, 'test-version');
  });
}
for (const browser of ['', 'chrome', 'safari', 'Firefox', 'chromium,webkit', null]) {
  test(`capture selection rejects ${JSON.stringify(browser)}`, () => {
    assert.equal(typeof browserOptions.captureBrowserOptions, 'function');
    assert.throws(() => browserOptions.captureBrowserOptions({ browser }), /browser.*chromium.*firefox.*webkit/i);
  });
}
test('Chromium executable stays explicit and cannot be used with another engine', () => {
  assert.equal(typeof browserOptions.captureBrowserOptions, 'function');
  assert.equal(browserOptions.captureBrowserOptions({ executablePath: './browser' }).launchOptions.executablePath, path.resolve('browser'));
  for (const browser of ['firefox', 'webkit']) assert.throws(() => browserOptions.captureBrowserOptions({ browser, executablePath: './browser' }), /Chromium executable/i);
});
test('a self-consistent pair from the wrong engine is incompatible', () => {
  const result = assessPair(page(), page(), comparison, null, 'webkit');
  assert.equal(result.comparable, false); assert.match(result.errors.join(' '), /requested browser/i);
});
test('two different engines cannot be compared even with equal version strings', () => {
  assert.equal(assessPair(page('firefox'), page('webkit'), comparison, null, 'firefox').comparable, false);
});
test('unknown matching engine metadata cannot masquerade as a supported engine', () => {
  assert.equal(assessPair(page('safari'), page('safari'), comparison).comparable, false);
});
test('suite verifier arguments propagate the engine as a literal value', () => {
  const args = buildVerifyArgs(item(), '/tmp/evidence');
  assert.equal(args[args.indexOf('--browser') + 1], 'webkit');
});
for (const [name, mutate] of [
  ['top-level engine mismatch', r => { r.browser = 'chromium'; }],
  ['missing top-level engine', r => { delete r.browser; }],
  ['row engine mismatch', r => { r.rows[0].browser = 'firefox'; }],
  ['missing row engine', r => { delete r.rows[0].browser; }],
  ['empty observed version', r => { r.rows[0].browserVersion = ''; }],
]) {
  test(`suite rejects ${name}`, () => {
    const i = item(), report = evidence(i); mutate(report);
    assert.equal(assessCase(report, i, ok).status, 'failed');
  });
}
test('matching suite retains engine identity in its result', () => {
  const i = item(), result = assessCase(evidence(i), i, ok);
  assert.equal(result.status, 'completed'); assert.equal(result.browser, 'webkit'); assert.equal(result.rows[0].browser, 'webkit');
});
test('paired and suite HTML display escaped engine labels and legacy unknowns', () => {
  const r = { status: 'completed', browser: 'webkit', rows: [], cases: [] };
  assert.match(renderReport(r), /Browser.*webkit/); assert.match(renderSuiteReport(r), /Browser.*webkit/);
  assert.match(renderReport({ rows: [] }), /Browser.*not recorded/);
  assert.equal(renderReport({ ...r, browser: '<script>' }).includes('<script>'), false);
});
for (const script of ['capture.mjs', 'verify.mjs', 'verify-suite.mjs']) {
  test(`${script} documents --browser`, async () => {
    const result = await run(script, ['--help']); assert.equal(result.code, 0); assert.match(result.stdout, /--browser/);
  });
  test(`${script} rejects invalid and incompatible engine before overwriting output`, async t => {
    const dir = await temp(t), manifest = path.join(dir, 'suite.json'), out = path.join(dir, 'owned');
    const { mkdir } = await import('node:fs/promises'); await mkdir(out);
    const tool = script === 'capture.mjs' ? 'capture' : script === 'verify.mjs' ? 'verify' : 'verify-suite';
    await writeFile(path.join(out, '.website-cloner-output.json'), JSON.stringify({ schema: 'website-cloner-output/v1', tool }));
    await writeFile(path.join(out, 'keep.txt'), 'keep');
    await writeFile(manifest, JSON.stringify({ schemaVersion: 1, sourceOrigin: 'https://source.test', targetOrigin: 'https://target.test', cases: [{ id: 'home', path: '/' }] }));
    const base = script === 'capture.mjs' ? ['--url', 'https://source.test/'] : script === 'verify.mjs' ? ['--source', 'https://source.test/', '--target', 'https://target.test/'] : ['--manifest', manifest];
    for (const args of [['--browser', 'safari'], ['--browser', 'webkit', '--executable-path', '/missing/chromium']]) {
      const result = await run(script, [...base, '--out', out, '--overwrite', ...args]);
      assert.notEqual(result.code, 0); assert.match(result.stderr, /browser must be|Chromium executable/i);
      assert.equal(await readFile(path.join(out, 'keep.txt'), 'utf8'), 'keep');
    }
  });
}
test('suite dry-run validates and exposes its selected browser without output', async t => {
  const dir = await temp(t), manifest = path.join(dir, 'suite.json'), out = path.join(dir, 'out');
  await writeFile(manifest, JSON.stringify({ schemaVersion: 1, sourceOrigin: 'https://source.test', targetOrigin: 'https://target.test', cases: [{ id: 'home', path: '/' }] }));
  const result = await run('verify-suite.mjs', ['--manifest', manifest, '--out', out, '--browser', 'firefox', '--dry-run']);
  assert.equal(result.code, 0, result.stderr); assert.equal(JSON.parse(result.stdout).browser, 'firefox'); await assert.rejects(access(out));
});
test('programmatic suite rejects browser/executable mismatch before reading executable or writing', async t => {
  const dir = await temp(t), out = path.join(dir, 'out');
  const plan = normalizeSuite({ schemaVersion: 1, sourceOrigin: 'https://source.test', targetOrigin: 'https://target.test', cases: [{ id: 'home', path: '/' }] }, { manifestPath: path.join(dir, 'suite.json') });
  await assert.rejects(runSuite(plan, { out, browser: 'webkit', executablePath: '/missing/chromium' }), /Chromium executable/i);
  await assert.rejects(access(out));
});

const enabled = Boolean(process.env.CAPTURE_TEST_BUNDLED_BROWSER || process.env.CAPTURE_TEST_EXECUTABLE_PATH);
const engines = process.env.CLONER_CAPTURE_ENGINES?.split(',') ?? ['chromium'];
assert.ok(engines.length && engines.every(name => ['chromium', 'firefox', 'webkit'].includes(name)), 'invalid test engine selection');
for (const browser of engines) {
  test(`real ${browser} suite captures matching original/implementation state and records actual engine`, { skip: !enabled, timeout: 180000 }, async t => {
    const dir = await temp(t);
    const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><html><meta charset="utf-8"><title>Owned fixture</title><style>body{margin:0;font:16px sans-serif}details{margin-top:30px}</style><h1>Paired fixture</h1><details><summary>FAQ</summary><p>Visible answer</p></details></html>'); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const origin = `http://127.0.0.1:${server.address().port}`, manifest = path.join(dir, 'suite.json'), out = path.join(dir, 'out');
      await writeFile(path.join(dir, 'actions.json'), JSON.stringify([{ type: 'click', selector: 'summary' }]));
      await writeFile(manifest, JSON.stringify({ schemaVersion: 1, sourceOrigin: origin, targetOrigin: origin, defaults: { widths: [320], height: 240 }, cases: [
        { id: 'plain', path: '/source', targetPath: '/target' }, { id: 'faq', path: '/source', targetPath: '/target', sourceActions: './actions.json', targetActions: './actions.json', state: 'faq' },
      ] }));
      const args = ['--manifest', manifest, '--out', out, '--browser', browser];
      if (process.env.CAPTURE_TEST_EXECUTABLE_PATH) args.push('--executable-path', process.env.CAPTURE_TEST_EXECUTABLE_PATH);
      const result = await run('verify-suite.mjs', args); assert.equal(result.code, 0, result.stderr + result.stdout);
      const report = JSON.parse(await readFile(path.join(out, 'suite.json'))); assert.equal(report.browser, browser); assert.equal(report.summary.completed, 2);
      for (const id of ['plain', 'faq']) {
        const paired = JSON.parse(await readFile(path.join(out, 'cases', id, 'verification.json')));
        assert.equal(paired.browser, browser); assert.equal(paired.rows[0].browser, browser); assert.equal(paired.rows[0].changedPixelRatio, 0); assert.equal(paired.rows[0].exactPixels.identical, true);
        assert.equal(paired.rows[0].visualGate, 'not_requested'); assert.equal(paired.functionalParity, 'not_verified');
        for (const side of ['source', 'target']) {
          const root = path.join(out, 'cases', id, side), captured = JSON.parse(await readFile(path.join(root, 'capture.json')));
          const p = JSON.parse(await readFile(path.join(root, '320x240/page.json')));
          assert.equal(captured.browser, browser); assert.equal(captured.actualBrowser, browser); assert.equal(p.environment.browser, browser);
          assert.ok(p.environment.browserVersion.length > 0); assert.equal(p.environment.browserVersion, paired.rows[0].browserVersion);
          assert.equal(p.actions.length, id === 'faq' ? 1 : 0); if (id === 'faq') assert.equal(p.actions[0].status, 'completed');
        }
      }
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
  test(`real ${browser} source HTTP failure never becomes a successful pair`, { skip: !enabled, timeout: 100000 }, async t => {
    const dir = await temp(t), out = path.join(dir, 'out');
    const server = createServer((req, res) => { res.writeHead(req.url === '/fail' ? 500 : 200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>Fixture</title><h1>Result</h1>'); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      const args = ['--source', `${origin}/fail`, '--target', origin, '--out', out, '--browser', browser, '--widths', '320', '--height', '240'];
      if (process.env.CAPTURE_TEST_EXECUTABLE_PATH) args.push('--executable-path', process.env.CAPTURE_TEST_EXECUTABLE_PATH);
      const result = await run('verify.mjs', args); assert.equal(result.code, 1);
      const report = JSON.parse(await readFile(path.join(out, 'verification.json'))); assert.equal(report.browser, browser); assert.equal(report.status, 'failed'); assert.equal(report.rows[0].comparable, false);
      await assert.rejects(access(path.join(out, 'comparisons/320x240/report.json')));
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
}
