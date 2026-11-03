import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { prepareProject } from '../scripts/lib/prepare-project.mjs';
import { loadSuite } from '../scripts/lib/suite-config.mjs';
import { captureFixture } from './helpers/preparation-fixture.mjs';
const hash = b => createHash('sha256').update(b).digest('hex');
const json = async f => JSON.parse(await readFile(f, 'utf8'));
async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'prepare-state-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const actions = path.join(dir, 'source-actions.json'); await writeFile(actions, JSON.stringify([{ type: 'click', selector: '#menu' }, { type: 'scroll', selector: '#faq' }]));
  return { dir, source: 'https://source.test/', target: 'http://127.0.0.1:9/target', out: path.join(dir, 'new/project'), widths: '120,240', height: '80', actions, state: 'menu-faq', scheme: 'dark', keepScroll: true };
}
async function stateFixture(script, args, options, change = () => {}) {
  const values = {}; for (let i = 0; i < args.length; i++) if (args[i] === '--keep-scroll') values.keepScroll = true; else values[args[i++].slice(2)] = args[i];
  const pairedArgs = args.filter(a => a !== '--keep-scroll');
  const result = await captureFixture(script, pairedArgs, options, m => { m.state = values.state; m.scheme = values.scheme; m.keepScroll = Boolean(values.keepScroll); });
  const actions = values.actions ? await json(values.actions) : [];
  const file = path.join(values.out, 'capture.json'), m = await json(file);
  for (const row of m.captures) {
    const pfile = path.join(values.out, row.directory, 'page.json'), p = await json(pfile);
    p.actions = actions.map(a => ({ ...a, status: 'completed', scrollPosition: { x: 0, y: 20 } }));
    p.scrollState = { keepScroll: m.keepScroll, atCapture: { x: 0, y: m.keepScroll ? 20 : 0 } };
    change(m, p); await writeFile(pfile, JSON.stringify(p));
  }
  await writeFile(file, JSON.stringify(m)); return result;
}
for (const [name, override] of [
  ['empty state', { state: '' }], ['whitespace state', { state: ' ' }], ['long state', { state: 'x'.repeat(121) }], ['control state', { state: 'x\ny' }],
  ['invalid scheme', { scheme: 'auto' }], ['nonboolean scroll', { keepScroll: 'yes' }], ['missing action file', { actions: '/nonexistent/cloner-actions.json' }],
  ['target override without source', { actions: undefined, targetActions: 'elsewhere.json' }],
]) test(`state preflight rejects ${name} before writes or child launch`, async t => {
  const f = await fixture(t); let called = false;
  await assert.rejects(prepareProject({ ...f, ...override }, { execute: () => { called = true; throw Error('unexpected launch'); } }));
  assert.equal(called, false); await assert.rejects(stat(path.dirname(f.out)), { code: 'ENOENT' });
});
for (const [name, value] of [
  ['invalid JSON', '{'], ['object', '{}'], ['too many actions', JSON.stringify(Array(51).fill({ type: 'click', selector: '#x' }))],
  ['javascript', '[{"type":"evaluate","selector":"alert(1)"}]'], ['extra key', '[{"type":"click","selector":"#x","script":"x"}]'],
  ['empty selector', '[{"type":"click","selector":" "}]'], ['control selector', JSON.stringify([{ type: 'click', selector: '#x\ny' }])],
  ['long selector', JSON.stringify([{ type: 'click', selector: 'x'.repeat(2001) }])], ['oversized file', ' '.repeat(100001)],
]) test(`action preflight rejects ${name}`, async t => {
  const f = await fixture(t); await writeFile(f.actions, value);
  await assert.rejects(prepareProject({ ...f, dryRun: true })); await assert.rejects(stat(path.dirname(f.out)), { code: 'ENOENT' });
});
test('rejects action symlink and directory during dry-run', async t => {
  const f = await fixture(t), link = path.join(f.dir, 'link.json'); await symlink(f.actions, link);
  for (const actions of [link, f.dir]) await assert.rejects(prepareProject({ ...f, actions, dryRun: true }), /regular|symbolic|file/i);
});
test('dry-run validates and describes state without files, processes or original-path leakage', async t => {
  const f = await fixture(t), r = await prepareProject({ ...f, dryRun: true }, { execute: () => assert.fail('must not run') });
  assert.equal(r.status, 'planned'); assert.equal(r.networkAccess, false); assert.equal(r.captureState.state, f.state);
  assert.equal(r.captureState.scheme, 'dark'); assert.equal(r.captureState.keepScroll, true); assert.equal(r.captureState.sourceActions.count, 2);
  assert.equal(r.captureState.sourceActions.path, 'actions/source.json'); assert.equal(r.captureState.targetActions.path, 'actions/source.json');
  assert.equal(r.captureState.targetActionsVerified, false); assert.ok(!JSON.stringify(r).includes(f.actions));
  await assert.rejects(stat(path.dirname(f.out)), { code: 'ENOENT' });
});
test('shared actions are snapshotted, hashed and mapped into the reusable suite', async t => {
  const f = await fixture(t); let launchArgs;
  const r = await prepareProject(f, { execute: async (...args) => { launchArgs = args[1]; await writeFile(f.actions, '[]'); return stateFixture(...args); } });
  assert.equal(r.status, 'prepared'); assert.equal(r.targetVisited, false); assert.equal(r.functionalParity, 'not_verified');
  assert.ok(launchArgs.includes('--keep-scroll')); assert.ok(!launchArgs.includes(f.actions)); assert.ok(!launchArgs.includes(f.target));
  const snapshot = await readFile(path.join(f.out, 'actions/source.json'));
  assert.equal(JSON.parse(snapshot).length, 2); assert.equal(r.captureState.sourceActions.sha256, hash(snapshot));
  const suite = await loadSuite(path.join(f.out, 'suite.json')), c = suite.cases[0];
  assert.equal(c.state, f.state); assert.equal(c.scheme, f.scheme); assert.equal(c.keepScroll, true); assert.equal(c.sourceActions, c.targetActions);
  assert.equal(JSON.parse(await readFile(path.join(f.out, 'assets.json'))).assets.length, 0);
  assert.match(await readFile(path.join(f.out, 'START-HERE.md'), 'utf8'), /captureState/);
});
test('target override is copied but never executed during preparation', async t => {
  const f = await fixture(t), targetActions = path.join(f.dir, 'target.json'); await writeFile(targetActions, '[{"type":"click","selector":"#rebuilt-menu"}]');
  const r = await prepareProject({ ...f, targetActions }, { execute: async (s, a, o) => {
    assert.ok(!a.includes(targetActions)); assert.match(a[a.indexOf('--actions') + 1], /source\.json$/); return stateFixture(s, a, o);
  } });
  assert.equal(r.status, 'prepared'); const c = (await loadSuite(path.join(f.out, 'suite.json'))).cases[0];
  assert.notEqual(c.sourceActions, c.targetActions); assert.equal((await json(c.targetActions))[0].selector, '#rebuilt-menu'); assert.equal(r.captureState.targetActionsVerified, false);
});
for (const [name, mutate] of [
  ['missing action', (_m, p) => p.actions.pop()], ['reordered actions', (_m, p) => p.actions.reverse()],
  ['different selector', (_m, p) => { p.actions[0].selector = '#wrong'; }], ['different type', (_m, p) => { p.actions[0].type = 'scroll'; }],
  ['incomplete action', (_m, p) => { p.actions[0].status = 'pending'; }], ['manifest scroll mismatch', m => { m.keepScroll = false; }],
  ['page scroll mismatch', (_m, p) => { p.scrollState.keepScroll = false; }],
]) test(`capture exit zero cannot hide ${name}`, async t => {
  const f = await fixture(t), r = await prepareProject(f, { execute: (s, a, o) => stateFixture(s, a, o, mutate) });
  assert.equal(r.status, 'failed'); assert.equal(r.stages[1].status, 'failed'); assert.equal(r.stages[2].status, 'not_started');
});
test('changed copied actions cannot mark state ready even when child succeeds', async t => {
  const f = await fixture(t), r = await prepareProject(f, { execute: async (...args) => {
    const result = await stateFixture(...args); await writeFile(path.join(f.out, 'actions/source.json'), '[]'); return result;
  } }); assert.equal(r.status, 'failed'); assert.match(r.stages[1].error, /snapshot|actions|hash/i);
});
test('CLI accepts explicit states and actions in offline dry-run', async t => {
  const f = await fixture(t); const r = spawnSync(process.execPath, ['scripts/prepare-clone.mjs', '--source', f.source, '--target', f.target, '--out', f.out, '--actions', f.actions, '--state', f.state, '--scheme', 'dark', '--keep-scroll', '--dry-run'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).captureState.scheme, 'dark');
});
test('rejects canonical snapshot over capture byte cap before writing', async t => {
  const f = await fixture(t), actions = Array.from({ length: 49 }, () => ({ type: 'click', selector: 'x'.repeat(2000) }));
  const raw = JSON.stringify(actions); assert.ok(Buffer.byteLength(raw) < 100000); assert.ok(Buffer.byteLength(JSON.stringify(actions, null, 2)) > 100000);
  await writeFile(f.actions, raw); await assert.rejects(prepareProject({ ...f, dryRun: true }), /size|100000|large/i);
});
test('state label is escaped in HTML and not interpolated into instructions', async t => {
  const f = await fixture(t), state = '<script>alert(1)</script>';
  const r = await prepareProject({ ...f, state }, { execute: stateFixture }); assert.equal(r.status, 'prepared');
  const page = await readFile(path.join(f.out, 'index.html'), 'utf8'); assert.ok(!page.includes(state)); assert.ok(page.includes('&lt;script&gt;'));
  assert.ok(!(await readFile(path.join(f.out, 'START-HERE.md'), 'utf8')).includes(state));
});
