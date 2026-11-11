import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planPreparationState, assertPreparationState } from '../scripts/lib/preparation-state.mjs';
import { loadSuite } from '../scripts/lib/suite-config.mjs';
import { readObservations } from '../scripts/lib/observations.mjs';
import { assessPair } from '../scripts/lib/verification.mjs';
import { captureFixture } from './helpers/preparation-fixture.mjs';

const specs = [
  { type: 'assert', selector: '#menu', check: 'visible' },
  { type: 'assert', selector: '#menu', check: 'hidden', timeoutMs: 250 },
  { type: 'assert', selector: '#toggle', check: 'attribute', attribute: 'aria-expanded', value: 'true' },
  { type: 'assert', selector: '#faq', check: 'attribute', attribute: 'open', value: '', timeoutMs: 10000 },
];
async function setup(t, actions) {
  const dir = await mkdtemp(path.join(tmpdir(), 'cloner-assert-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'actions.json'); await writeFile(file, JSON.stringify(actions));
  const manifest = path.join(dir, 'suite.json');
  await writeFile(manifest, JSON.stringify({ schemaVersion: 1, sourceOrigin: 'https://source.test', targetOrigin: 'http://127.0.0.1:9', defaults: { widths: [120], height: 80 }, cases: [{ id: 'page', path: '/', sourceActions: 'actions.json' }] }));
  return { dir, file, manifest };
}
for (const spec of specs) test(`assertion survives preparation and suite preflight: ${spec.check} ${spec.attribute || ''}`, async t => {
  const f = await setup(t, [{ type: 'click', selector: '#toggle' }, spec]);
  const plan = await planPreparationState({ actions: f.file });
  assert.deepEqual(JSON.parse(plan.source.content), [{ type: 'click', selector: '#toggle' }, spec]);
  assert.equal(plan.source.count, 2); assert.equal(plan.source, plan.target);
  assert.equal((await loadSuite(f.manifest)).cases.length, 1);
});
for (const [name, bad] of [
  ['unknown check', { ...specs[0], check: 'evaluate' }], ['missing value', { ...specs[2], value: undefined }],
  ['non-string value', { ...specs[2], value: true }], ['oversize value', { ...specs[2], value: 'x'.repeat(2001) }],
  ['control value', { ...specs[2], value: 'a\nb' }], ['unsafe attribute', { ...specs[2], attribute: 'x onclick=' }],
  ['zero timeout', { ...specs[0], timeoutMs: 0 }], ['oversized timeout', { ...specs[0], timeoutMs: 10001 }],
  ['fractional timeout', { ...specs[0], timeoutMs: 1.2 }], ['string timeout', { ...specs[0], timeoutMs: '10' }],
  ['extra attribute on visibility', { ...specs[0], attribute: 'hidden' }], ['script', { ...specs[0], script: 'alert(1)' }],
]) test(`assertion preflight rejects ${name}`, async t => {
  const f = await setup(t, [bad]);
  await assert.rejects(planPreparationState({ actions: f.file })); await assert.rejects(loadSuite(f.manifest));
});
const page = actions => ({ status: 'completed', viewport: { width: 120, height: 80, deviceScaleFactor: 1 }, state: 'default', scheme: 'light', reducedMotion: 'reduce', environment: { browser: 'chromium', browserVersion: 'test', headless: true, locale: 'en-US', timezoneId: 'UTC', isMobile: false, hasTouch: false, freshContext: true }, screenshots: { viewport: 'viewport.png', animations: 'disabled', caret: 'hide' }, actions });
const completed = (spec, observed) => ({ ...spec, status: 'completed', assertion: { status: 'passed', observed } });
for (const [name, a] of [
  ['missing assertion evidence', { ...specs[0], status: 'completed' }],
  ['false visible', completed(specs[0], { count: 1, visible: false })],
  ['missing hidden selector', completed(specs[1], { count: 0, visible: false })],
  ['ambiguous selector', completed(specs[0], { count: 2, visible: true })],
  ['incorrect attribute', completed(specs[2], { count: 1, value: 'false', truncated: false })],
  ['truncated attribute', completed(specs[2], { count: 1, value: 'true', truncated: true })],
]) test(`successful pixels cannot override ${name}`, () => {
  const r = assessPair(page([a]), page([]), { status: 'compared', changedPixelRatio: 0, maxDiffRatio: null, passed: null });
  assert.equal(r.comparable, false); assert.equal(r.status, 'failed'); assert.equal(r.functionalParity, 'not_verified');
});
test('valid explicit assertions stay limited evidence, not functional parity', () => {
  const r = assessPair(page([completed(specs[0], { count: 1, visible: true })]), page([]), { status: 'compared', changedPixelRatio: 0, maxDiffRatio: null, passed: null });
  assert.equal(r.status, 'completed'); assert.equal(r.functionalParity, 'not_verified');
});
test('observer rejects a completed assertion without observed proof', async t => {
  const f = await setup(t, []), out = path.join(f.dir, 'source');
  await captureFixture('', ['--url', 'https://source.test/', '--browser', 'chromium', '--out', out, '--widths', '120', '--height', '80']);
  const filename = path.join(out, '120x80/page.json'), p = JSON.parse(await readFile(filename, 'utf8'));
  p.actions = [{ ...specs[0], status: 'completed' }]; await writeFile(filename, JSON.stringify(p));
  await assert.rejects(readObservations(out), /assertion|observed/i);
});
test('verify rejects a valid JSON but invalid action before creating output', async t => {
  const f = await setup(t, [{ ...specs[0], check: 'bogus' }]), out = path.join(f.dir, 'output');
  const r = spawnSync(process.execPath, ['scripts/verify.mjs', '--source', 'https://source.test/', '--target', 'http://127.0.0.1:9', '--source-actions', f.file, '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 1); await assert.rejects(readFile(path.join(out, 'verification.json')), { code: 'ENOENT' });
});
