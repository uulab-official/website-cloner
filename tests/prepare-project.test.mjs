import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { planProject } from '../scripts/lib/project-init.mjs';
import { captureFixture, successful } from './helpers/preparation-fixture.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const module = await import('../scripts/lib/prepare-project.mjs').catch(() => ({}));
async function prepare(options, adapters) { assert.equal(typeof module.prepareProject, 'function', 'prepareProject must be implemented'); return module.prepareProject(options, adapters); }
const run = args => spawnSync(process.execPath, [path.join(root, 'scripts/prepare-clone.mjs'), ...args], { encoding: 'utf8', timeout: 30000 });
async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'cloner-prepare-')); t.after(() => rm(dir, { recursive: true, force: true }));
  return { dir, source: 'https://source.test/page?q=x%26y', target: 'http://127.0.0.1:9/not-running', out: path.join(dir, 'new/project'), widths: '120,240', height: '80' };
}
const saved = async out => JSON.parse(await readFile(path.join(out, 'preparation.json'), 'utf8'));
test('help is offline and names the explicit opt-in command', () => { const r = run(['--help']); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /prepare:clone/); assert.match(r.stdout, /not.*(?:generate|clone)/i); });
test('npm command is not the installation prepare lifecycle', async () => { const pkg = JSON.parse(await readFile(path.join(root, 'package.json'))); assert.equal(pkg.scripts['prepare:clone'], 'node scripts/prepare-clone.mjs'); assert.equal(pkg.scripts.prepare, undefined); });
test('dry run resolves a new plan without subprocess, network or parent creation', async t => {
  const f = await fixture(t); let calls = 0;
  const r = await prepare({ ...f, dryRun: true }, { execute: () => { calls++; throw Error('must not run'); } });
  assert.equal(r.status, 'planned'); assert.equal(r.networkAccess, false); assert.equal(r.browser, 'chromium'); assert.equal(calls, 0);
  assert.equal(r.targetVisited, false); assert.equal(r.implementation, 'not_started');
  await assert.rejects(stat(path.dirname(f.out)), { code: 'ENOENT' });
});
for (const [name, change, error] of [
  ['source credentials', { source: 'https://name:password@source.test/' }, /credential/i],
  ['source fragment', { source: 'https://source.test/#x' }, /fragment/i],
  ['traversal route', { source: 'https://source.test/a/../b' }, /path|segment|traversal/i],
  ['bad target', { target: 'file:///private' }, /HTTP/i],
  ['repeated widths', { widths: '120,120' }, /width/i],
  ['bad height', { height: '0' }, /height/i],
  ['unknown engine', { browser: 'safari' }, /browser/i],
  ['timeout too small', { timeoutMs: 1 }, /timeout/i],
  ['timeout too big', { timeoutMs: 900001 }, /timeout/i],
  ['timeout string junk', { timeoutMs: 'abc' }, /timeout/i],
  ['nonboolean dry run', { dryRun: 'yes' }, /boolean/i],
  ['engine executable mismatch', { browser: 'firefox', executablePath: process.execPath }, /Chromium/i],
  ['missing executable', { executablePath: '/no-such-browser-website-cloner' }, /executable|ENOENT/i],
]) test(`preflight rejects ${name} without files or subprocess`, async t => {
  const f = await fixture(t); let calls = 0;
  await assert.rejects(prepare({ ...f, ...change }, { execute: () => { calls++; } }), error);
  assert.equal(calls, 0); await assert.rejects(stat(path.dirname(f.out)), { code: 'ENOENT' });
});
for (const kind of ['directory', 'file', 'symlink']) test(`refuses an existing ${kind} without modifying it`, async t => {
  const f = await fixture(t); await mkdir(path.dirname(f.out), { recursive: true });
  if (kind === 'directory') await mkdir(f.out); else if (kind === 'file') await writeFile(f.out, 'keep'); else await symlink(f.dir, f.out);
  await assert.rejects(prepare(f, { execute: () => { throw Error('must not run'); } }), /exists/i);
  if (kind === 'file') assert.equal(await readFile(f.out, 'utf8'), 'keep');
});
test('refuses protected repository directory', async t => { const f = await fixture(t); await assert.rejects(prepare({ ...f, out: path.join(root, 'scripts/new-prepare-output') }), /protected/i); });
test('success uses one fixed capture process and preserves init documents byte-for-byte', async t => {
  const f = await fixture(t), calls = [];
  const r = await prepare(f, { execute: async (...args) => { calls.push(args); return captureFixture(...args); } });
  assert.equal(r.status, 'prepared'); assert.equal(r.functionalParity, 'not_verified'); assert.equal(r.visualComparison, 'not_performed'); assert.equal(r.targetVisited, false); assert.equal(r.reviewRequired, true);
  assert.equal(calls.length, 1); assert.equal(calls[0][0], path.join(root, 'scripts/capture.mjs')); assert.ok(!calls[0][1].includes(f.target)); assert.equal(calls[0][2].timeoutMs, 300000);
  assert.deepEqual(r.stages.map(s => [s.id, s.status]), [['initialize', 'completed'], ['capture', 'completed'], ['observe', 'completed'], ['handoff', 'completed']]);
  for (const [file, content] of Object.entries(planProject(f).files)) assert.equal(await readFile(path.join(f.out, file), 'utf8'), content);
  const disk = await saved(f.out); assert.deepEqual(disk, r); assert.equal(r.summary.views, 2); assert.equal(r.summary.warnings, 2, 'old fixture has no media coverage');
  assert.match(await readFile(path.join(f.out, 'START-HERE.md'), 'utf8'), /observations\/observation.json/);
  assert.match(await readFile(path.join(f.out, 'START-HERE.md'), 'utf8'), /assets.json/);
  assert.match(await readFile(path.join(f.out, 'logs/capture.stdout.log'), 'utf8'), /fixture/);
  const html = await readFile(path.join(f.out, 'index.html'), 'utf8'); assert.match(html, /observations\/index.html/); assert.ok(!/<(?:script|iframe|img|video|audio)[\s>]/i.test(html));
  assert.ok(!html.includes('Untrusted')); assert.ok(!html.includes(f.source));
});
test('source query stays a literal subprocess argument, never an instruction', async t => {
  const f = await fixture(t), source = 'https://source.test/page?q=$(whoami);%3Cscript%3E'; let args;
  const r = await prepare({ ...f, source }, { execute: async (s, a, o) => { args = a; return captureFixture(s, a, o); } });
  assert.equal(r.status, 'prepared'); assert.equal(args[args.indexOf('--url') + 1], source); assert.ok(!(await readFile(path.join(f.out, 'START-HERE.md'), 'utf8')).includes(source));
});
for (const browser of ['firefox', 'webkit']) test(`explicit ${browser} is forwarded and recorded`, async t => {
  const f = await fixture(t); const r = await prepare({ ...f, browser }, { execute: captureFixture }); assert.equal(r.browser, browser); assert.equal(r.status, 'prepared');
});
for (const [name, result] of [
  ['exit failure', { exitCode: 1 }], ['signal', { signal: 'SIGKILL' }], ['timeout', { timedOut: true }],
  ['interruption', { interrupted: true }], ['spawn error', { error: 'spawn unavailable' }], ['missing result', null],
]) test(`preserves ${name} as failed capture with later stages not started`, async t => {
  const f = await fixture(t);
  const r = await prepare(f, { execute: async () => result ? { ...successful(), ...result } : null });
  assert.equal(r.status, 'failed'); assert.equal(r.stages[1].status, 'failed'); assert.equal(r.stages[2].status, 'not_started'); assert.equal((await saved(f.out)).status, 'failed');
  await assert.rejects(stat(path.join(f.out, 'observations')), { code: 'ENOENT' }); assert.ok((await stat(path.join(f.out, 'suite.json'))).isFile());
  const html = await readFile(path.join(f.out, 'index.html'), 'utf8'); assert.match(html, /failed/); assert.ok(!html.includes('href="observations/index.html"'));
});
test('thrown capture error is journaled and HTML escaped', async t => {
  const f = await fixture(t); const r = await prepare(f, { execute: async () => { throw Error('<img src=x onerror=alert(1)>'); } });
  assert.equal(r.status, 'failed'); const h = await readFile(path.join(f.out, 'index.html'), 'utf8'); assert.ok(!h.includes('<img')); assert.match(h, /&lt;img/);
});
test('zero exit with no capture files cannot mark preparation ready', async t => {
  const f = await fixture(t); const r = await prepare(f, { execute: async () => successful() }); assert.equal(r.status, 'failed'); assert.equal(r.stages[1].status, 'failed'); await assert.rejects(stat(path.join(f.out, 'START-HERE.md')), { code: 'ENOENT' });
});
for (const [name, mutate] of [
  ['wrong source', m => { m.requestedUrl = 'https://elsewhere.test/'; }], ['wrong widths', m => { m.widths = [121]; }],
  ['wrong height', m => { m.height = 81; }], ['wrong browser', m => { m.browser = m.actualBrowser = 'firefox'; }],
  ['wrong state', m => { m.state = 'menu'; }], ['wrong scheme', m => { m.scheme = 'dark'; }],
]) test(`valid but ${name} capture is rejected against the request`, async t => {
  const f = await fixture(t); const r = await prepare(f, { execute: (s, a, o) => captureFixture(s, a, o, mutate) });
  assert.equal(r.status, 'failed'); assert.equal(r.stages[1].status, 'failed'); await assert.rejects(stat(path.join(f.out, 'observations')), { code: 'ENOENT' });
});
test('existing observations created during capture are never overwritten', async t => {
  const f = await fixture(t); const r = await prepare(f, { execute: async (...args) => { await captureFixture(...args); await mkdir(path.join(f.out, 'observations')); await writeFile(path.join(f.out, 'observations/keep.txt'), 'keep'); return successful(); } });
  assert.equal(r.status, 'failed'); assert.equal(r.stages[2].status, 'failed'); assert.equal(await readFile(path.join(f.out, 'observations/keep.txt'), 'utf8'), 'keep');
});
for (const args of [[], ['--source', 'https://example.com'], ['--overwrite'], ['--actions', 'x'], ['--timeout-ms', '0']]) test(`CLI rejects incomplete or unsupported options: ${args.join(' ')}`, () => { const r = run(args); assert.equal(r.status, 1); assert.match(r.stderr, /Required|Unknown|timeout/); });
test('CLI dry-run succeeds without installed browser dependencies', async t => { const f = await fixture(t); const r = run(['--source', f.source, '--target', f.target, '--out', f.out, '--dry-run']); assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).status, 'planned'); });
