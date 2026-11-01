import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { normalizeSuite, loadSuite, buildVerifyArgs } from '../scripts/lib/suite-config.mjs';

const input = () => ({ schemaVersion: 1, sourceOrigin: 'https://source.test', targetOrigin: 'http://localhost:4173', cases: [{ id: 'services', path: '/services/' }] });
const normalize = value => normalizeSuite(value, { manifestPath: '/tmp/manifests/suite.json' });

test('defaults preserve ungated evidence and exact source/target paths', () => {
  const plan = normalize(input()); const item = plan.cases[0];
  assert.equal(item.sourceUrl, 'https://source.test/services/');
  assert.equal(item.targetUrl, 'http://localhost:4173/services/');
  assert.deepEqual(item.widths, [1440, 768, 390]);
  assert.equal(item.height, 900); assert.equal(item.scheme, 'light');
  assert.equal(item.maxDiffRatio, null); assert.equal(item.state, 'default');
  assert.equal(item.keepScroll, false);
});
test('route mapping and per-case explicit null override defaults', () => {
  const value = input(); value.defaults = { widths: [390], maxDiffRatio: 0.02, scheme: 'dark' };
  Object.assign(value.cases[0], { targetPath: '/clone/services/?tab=plans', maxDiffRatio: null, state: 'faq-open', keepScroll: true });
  const item = normalize(value).cases[0];
  assert.equal(item.targetUrl, 'http://localhost:4173/clone/services/?tab=plans');
  assert.deepEqual(item.widths, [390]); assert.equal(item.scheme, 'dark'); assert.equal(item.maxDiffRatio, null);
});
test('origins can be overridden without editing checked-in manifest', () => {
  const plan = normalizeSuite(input(), { manifestPath: '/tmp/suite.json', sourceOrigin: 'http://localhost:9000', targetOrigin: 'http://localhost:5000' });
  assert.equal(plan.cases[0].sourceUrl, 'http://localhost:9000/services/');
  assert.equal(plan.cases[0].targetUrl, 'http://localhost:5000/services/');
});
for (const origin of ['file:///tmp/a', 'https://user:pass@source.test', 'https://source.test/path', 'https://source.test/?token=secret', 'https://source.test/#x', 'https://source.test/\n', 12]) {
  test(`reject invalid origin ${JSON.stringify(origin)}`, () => {
    const value = input(); value.sourceOrigin = origin;
    assert.throws(() => normalize(value), /origin/i);
  });
}
for (const route of ['//evil.test/a', '/\\evil.test', '/%5cevil.test', '/%2f%2fevil.test', 'https://evil.test', '/a/../b', '/%2e%2e/b', '/a\nb', '/a#x', '/%zz']) {
  test(`reject ambiguous route ${JSON.stringify(route)}`, () => {
    const value = input(); value.cases[0].path = route;
    assert.throws(() => normalize(value), /path|route/i);
  });
}
for (const id of ['..', '../bad', 'a/b', 'a\\b', 'CON', 'lpt1', '.', '', 'a'.repeat(65)]) {
  test(`reject unsafe case id ${JSON.stringify(id)}`, () => {
    const value = input(); value.cases[0].id = id;
    assert.throws(() => normalize(value), /id/i);
  });
}
test('case IDs collide case-insensitively and empty suites fail', () => {
  const value = input(); value.cases.push({ ...value.cases[0], id: 'SERVICES' });
  assert.throws(() => normalize(value), /duplicate/i);
  value.cases = []; assert.throws(() => normalize(value), /cases/i);
  value.cases = Array.from({ length: 51 }, (_, i) => ({ id: `c${i}`, path: '/' }));
  assert.throws(() => normalize(value), /50/);
});
for (const [field, bad] of [['widths', []], ['widths', [390, 390]], ['widths', ['390']], ['widths', [8193]], ['height', 0], ['height', '900'], ['scheme', 'auto'], ['keepScroll', 'false'], ['maxDiffRatio', 2], ['maxDiffRatio', '0.1'], ['state', 'a\nb'], ['state', ''], ['timeoutMs', 0], ['timeoutMs', 3600001]]) {
  test(`reject invalid ${field}=${JSON.stringify(bad)}`, () => {
    const value = input(); value.cases[0][field] = bad;
    assert.throws(() => normalize(value), new RegExp(field, 'i'));
  });
}
test('reject unknown fields at every level to catch configuration typos', () => {
  const root = input(); root.command = 'anything'; assert.throws(() => normalize(root), /unknown/i);
  const defaults = input(); defaults.defaults = { width: 390 }; assert.throws(() => normalize(defaults), /unknown/i);
  const item = input(); item.cases[0].sourceURL = 'x'; assert.throws(() => normalize(item), /unknown/i);
  const proto = JSON.parse('{"schemaVersion":1,"__proto__":{},"sourceOrigin":"https://source.test","targetOrigin":"http://localhost","cases":[{"id":"a","path":"/"}]}');
  assert.throws(() => normalize(proto), /unknown/i);
});
test('buildVerifyArgs preserves literals without shell expansion', () => {
  const value = input(); Object.assign(value.cases[0], { widths: [390], sourceActions: './actions/menu $x.json', targetActions: './actions/menu $x.json', keepScroll: true, maxDiffRatio: 0 });
  const item = normalize(value).cases[0];
  const args = buildVerifyArgs(item, '/tmp/out path', '/tmp/browser path');
  assert.ok(args.includes('/tmp/manifests/actions/menu $x.json'));
  assert.ok(args.includes('/tmp/out path')); assert.ok(args.includes('--keep-scroll'));
  assert.equal(args[args.indexOf('--max-diff-ratio') + 1], '0');
  assert.equal(args[args.indexOf('--executable-path') + 1], '/tmp/browser path');
  assert.equal(args.includes('--overwrite'), false);
});
test('preflight resolves action files relative to manifest, validates content and protects inputs', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloner-suite-config-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'actions'));
  const file = path.join(root, 'suite.json'); const action = path.join(root, 'actions', 'menu.json');
  const value = input(); value.cases[0].sourceActions = './actions/menu.json';
  await writeFile(file, JSON.stringify(value)); await writeFile(action, '[{"type":"click","selector":"#menu"}]');
  const plan = await loadSuite(file);
  assert.ok(plan.protectedPaths.includes(file)); assert.ok(plan.protectedPaths.includes(action));
  await writeFile(action, '[{"type":"evaluate","selector":"alert(1)"}]');
  await assert.rejects(loadSuite(file), /action/i);
  await writeFile(action, '[{"type":"click","selector":"#menu","script":"alert(1)"}]');
  await assert.rejects(loadSuite(file), /action/i);
  await writeFile(action, ' '.repeat(100001)); await assert.rejects(loadSuite(file), /100/);
  await rm(action); await assert.rejects(loadSuite(file), /ENOENT|file/i);
});
test('reject oversized, invalid JSON and non-file manifests', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloner-suite-json-'));
  t.after(() => rm(root, { recursive: true, force: true })); const file = path.join(root, 'suite.json');
  await assert.rejects(loadSuite(root), /file/i);
  await writeFile(file, '{'); await assert.rejects(loadSuite(file), /JSON/i);
  await writeFile(file, ' '.repeat(1000001)); await assert.rejects(loadSuite(file), /1000000|1 MB/);
});

test('explicit null defaults and targetPath are invalid rather than silently ignored', () => {
  const defaults = input(); defaults.defaults = null; assert.throws(() => normalize(defaults), /defaults/);
  const route = input(); route.cases[0].targetPath = null; assert.throws(() => normalize(route), /targetPath/);
});
