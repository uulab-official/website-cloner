import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { normalizeSuite, loadSuite } from '../scripts/lib/suite-config.mjs';
import { assessCase, executeNodeScript, renderSuiteReport, runSuite } from '../scripts/lib/suite-runner.mjs';

const command = { exitCode: 0, signal: null, error: null, timedOut: false, stdout: '', stderr: '' };
const planFor = root => normalizeSuite({ schemaVersion: 1, sourceOrigin: 'https://source.test', targetOrigin: 'http://localhost:4173', defaults: { widths: [390] }, cases: [{ id: 'first', path: '/' }, { id: 'second', path: '/services/' }] }, { manifestPath: path.join(root, 'suite.json') });
function evidence(item) {
  return { schemaVersion: 1, tool: 'website-cloner/verify', status: 'completed', browser: item.browser, sourceUrl: item.sourceUrl, targetUrl: item.targetUrl, widths: item.widths, height: item.height, scheme: item.scheme, state: item.state, maxDiffRatio: item.maxDiffRatio, errors: [], commands: { source: command, target: command }, functionalParity: 'not_verified', motionVerified: false,
    rows: item.widths.map(width => ({ browser: item.browser, browserVersion: 'contract-fixture', width, height: item.height, status: 'completed', comparable: true, sourceCaptured: true, targetCaptured: true, hasComparison: true, visualGate: item.maxDiffRatio === null ? 'not_requested' : 'passed', changedPixelRatio: 0, errors: [], warnings: [], command })) };
}
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloner-suite-run-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const plan = planFor(root); await writeFile(plan.manifestPath, '{}');
  return { root, plan, out: path.join(root, 'out') };
}
async function complete({ item, out }) {
  await mkdir(out, { recursive: true }); await writeFile(path.join(out, 'verification.json'), JSON.stringify(evidence(item)));
  await writeFile(path.join(out, 'index.html'), '<!doctype html><title>test verifier report</title>');
  // Contract fixture files, not rendered image evidence.
  for (const width of item.widths) {
    const folder = `${width}x${item.height}`;
    for (const [subdir, names] of [[`source/${folder}`, ['page.json', 'viewport.png', 'full-page.png']], [`target/${folder}`, ['page.json', 'viewport.png', 'full-page.png']], [`comparisons/${folder}`, ['report.json', 'diff.png', 'side-by-side.png']]]) {
      await mkdir(path.join(out, subdir), { recursive: true });
      for (const name of names) await writeFile(path.join(out, subdir, name), 'contract fixture');
    }
  }
  return { ...command };
}
test('successful execution without threshold is not a visual pass', () => {
  const item = planFor('/tmp').cases[0]; const result = assessCase(evidence(item), item, command);
  assert.equal(result.status, 'completed'); assert.equal(result.visualGate, 'not_requested');
  assert.equal(result.functionalParity, 'not_verified');
});
test('explicit threshold pass and failure use every viewport', () => {
  const item = { ...planFor('/tmp').cases[0], widths: [1440, 390], maxDiffRatio: 0.02 };
  assert.equal(assessCase(evidence(item), item, command).visualGate, 'passed');
  const report = evidence(item); report.rows[1].changedPixelRatio = 0.5;
  assert.equal(assessCase(report, item, command).status, 'failed');
});
for (const mutate of [
  r => { r.rows = []; }, r => { r.rows[0].width = 123; }, r => { r.rows.push(r.rows[0]); },
  r => { r.sourceUrl = 'https://elsewhere.test/'; }, r => { r.targetUrl = 'https://elsewhere.test/'; },
  r => { r.state = 'another'; }, r => { r.scheme = 'dark'; }, r => { r.height = 600; },
  r => { r.maxDiffRatio = 0.1; }, r => { r.widths = [123]; }, r => { r.tool = 'other'; },
  r => { r.schemaVersion = 2; }, r => { r.status = 'running'; },
  r => { r.rows[0].changedPixelRatio = null; }, r => { r.rows[0].changedPixelRatio = -0.1; },
  r => { r.rows[0].changedPixelRatio = 2; }, r => { r.rows[0].changedPixelRatio = '0'; },
  r => { r.rows[0].visualGate = 'passed'; }, r => { r.rows[0].sourceCaptured = false; },
  r => { r.rows[0].comparable = false; }, r => { r.rows[0].hasComparison = false; },
  r => { r.rows[0].errors = ['capture failed']; }, r => { r.errors = ['capture failed']; },
  r => { r.commands.source = { exitCode: 1 }; }, r => { r.rows[0].command = { exitCode: 1 }; },
  r => { r.rows[0].warnings = 'malformed'; },
]) {
  test(`invalid evidence fails closed: ${mutate.toString()}`, () => {
    const item = planFor('/tmp').cases[0]; const report = evidence(item); mutate(report);
    assert.equal(assessCase(report, item, command).status, 'failed');
  });
}
test('missing report, failed process and timeout never pass', () => {
  const item = planFor('/tmp').cases[0];
  assert.equal(assessCase(null, item, command).status, 'failed');
  for (const result of [{ ...command, exitCode: 1 }, { ...command, exitCode: null, signal: 'SIGKILL' }, { ...command, timedOut: true }, { ...command, error: 'spawn failed' }]) {
    assert.equal(assessCase(evidence(item), item, result).status, 'failed');
  }
});
test('diagnostics remain review warnings rather than functional pass', () => {
  const item = planFor('/tmp').cases[0]; const report = evidence(item); report.rows[0].warnings = ['target: pageErrors=1'];
  const result = assessCase(report, item, command);
  assert.equal(result.status, 'completed'); assert.equal(result.reviewRequired, true);
  assert.equal(result.warnings.length, 1); assert.equal(result.functionalParity, 'not_verified');
});
test('runner persists script-free reports and case results', async t => {
  const { plan, out } = await fixture(t);
  const report = await runSuite(plan, { out, execute: complete });
  assert.equal(report.status, 'completed'); assert.equal(report.summary.completed, 2);
  assert.equal(report.summary.visualPassed, 0); assert.equal(report.summary.visualNotRequested, 2);
  assert.equal(JSON.parse(await readFile(path.join(out, 'suite.json'), 'utf8')).status, 'completed');
  const html = await readFile(path.join(out, 'index.html'), 'utf8');
  assert.ok(html.includes('cases/first/index.html')); assert.equal(/<script/i.test(html), false);
});
test('failure continues to next case by default', async t => {
  const { plan, out } = await fixture(t); const called = [];
  const report = await runSuite(plan, { out, execute: async context => {
    called.push(context.item.id); if (context.item.id === 'first') throw new Error('browser missing'); return complete(context);
  } });
  assert.deepEqual(called, ['first', 'second']); assert.equal(report.status, 'failed');
  assert.equal(report.summary.failed, 1); assert.equal(report.summary.completed, 1);
});
test('fail-fast marks every unexecuted case skipped, never completed', async t => {
  const { plan, out } = await fixture(t); let calls = 0;
  const report = await runSuite(plan, { out, failFast: true, execute: async () => { calls++; return { ...command, exitCode: 1 }; } });
  assert.equal(calls, 1); assert.equal(report.summary.failed, 1); assert.equal(report.summary.skipped, 1);
  assert.equal(report.cases[1].status, 'skipped'); assert.equal(report.cases[1].visualGate, 'not_requested');
});
test('zero exit without report, malformed report, oversized report all fail', async t => {
  const { plan, root } = await fixture(t);
  for (const [i, text] of [undefined, '{', ' '.repeat(5000001)].entries()) {
    const report = await runSuite(plan, { out: path.join(root, `out${i}`), execute: async ({ out }) => {
      await mkdir(out, { recursive: true });
      if (text !== undefined) await writeFile(path.join(out, 'verification.json'), text);
      return { ...command };
    } });
    assert.equal(report.summary.failed, 2); assert.equal(report.status, 'failed');
  }
});
test('CLI output guards preserve user files, protected input and symlinks', async t => {
  const { plan, out, root } = await fixture(t);
  await mkdir(out); await writeFile(path.join(out, 'valuable.txt'), 'keep');
  await assert.rejects(runSuite(plan, { out, overwrite: true, execute: complete }), /not owned/i);
  assert.equal(await readFile(path.join(out, 'valuable.txt'), 'utf8'), 'keep');
  await assert.rejects(runSuite(plan, { out: root, overwrite: true, execute: complete }), /input file/i);
  await symlink(out, path.join(root, 'link'));
  await assert.rejects(runSuite(plan, { out: path.join(root, 'link'), execute: complete }), /symbolic/i);
});
test('overwrite replaces only recognized suite output', async t => {
  const { plan, out } = await fixture(t); await runSuite(plan, { out, execute: complete });
  await assert.rejects(runSuite(plan, { out, execute: complete }), /nonempty/i);
  const report = await runSuite(plan, { out, overwrite: true, execute: complete });
  assert.equal(report.status, 'completed');
});
test('HTML escapes injected text and never trusts arbitrary report URLs or IDs', () => {
  const html = renderSuiteReport({ status: 'failed', sourceOrigin: '<img src=x onerror=alert(1)>', targetOrigin: 'x', errors: ['<script>alert(1)</script>'], summary: {}, cases: [{ id: '../../evil', state: '<script>', status: 'failed', visualGate: 'not_requested', errors: ['<svg onload=x>'], warnings: [], reportAvailable: true }] });
  assert.equal(/<script|<svg|<img/i.test(html), false);
  assert.equal(html.includes('../../evil/index.html'), false);
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('Content-Security-Policy'));
});
test('real subprocess keeps literal arguments and bounds logs', async t => {
  const { root } = await fixture(t); const script = path.join(root, 'echo.mjs');
  await writeFile(script, 'process.stdout.write(process.argv[2]); process.stderr.write("x".repeat(40000));');
  const result = await executeNodeScript(script, ['$(never-run); literal'], { timeoutMs: 2000 });
  assert.equal(result.exitCode, 0); assert.equal(result.stdout, '$(never-run); literal');
  assert.ok(result.stderr.length <= 12000);
});
test('real hung subprocess times out and records kill', async t => {
  const { root } = await fixture(t); const script = path.join(root, 'hang.mjs');
  await writeFile(script, 'setInterval(() => {}, 1000);');
  const result = await executeNodeScript(script, [], { timeoutMs: 100 });
  assert.equal(result.timedOut, true); assert.notEqual(result.exitCode, 0); assert.match(result.error, /timeout/i);
});

test('missing or empty screenshot files fail even when JSON claims completion', async t => {
  const { plan, root } = await fixture(t);
  for (const mode of ['missing', 'empty']) {
    const report = await runSuite(plan, { out: path.join(root, mode), execute: async context => {
      const result = await complete(context);
      const filename = path.join(context.out, 'source', '390x900', 'viewport.png');
      if (mode === 'empty') { await mkdir(path.dirname(filename), { recursive: true }); await writeFile(filename, ''); }
      else await rm(filename, { force: true });
      return result;
    } });
    assert.equal(report.status, 'failed'); assert.equal(report.summary.failed, 2);
    assert.ok(report.cases[0].errors.some(message => /artifact|evidence/i.test(message)));
  }
});
test('interrupt stops a running child and releases signal listeners', async t => {
  const { root } = await fixture(t); const script = path.join(root, 'interrupt.mjs');
  await writeFile(script, 'setInterval(() => {}, 1000);');
  const before = process.listenerCount('SIGINT');
  const pending = executeNodeScript(script, [], { timeoutMs: 2000 });
  const timer = setTimeout(() => process.emit('SIGINT'), 50);
  const result = await pending; clearTimeout(timer);
  assert.equal(result.interrupted, true); assert.equal(result.timedOut, false);
  assert.equal(process.listenerCount('SIGINT'), before);
});
test('interrupted suite skips subsequent cases even without fail-fast', async t => {
  const { plan, out } = await fixture(t); let calls = 0;
  const report = await runSuite(plan, { out, execute: async () => { calls++; return { ...command, exitCode: null, interrupted: true, error: 'Interrupted by SIGINT' }; } });
  assert.equal(calls, 1); assert.equal(report.summary.skipped, 1); assert.equal(report.status, 'failed');
});
