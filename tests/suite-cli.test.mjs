import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../scripts/verify-suite.mjs', import.meta.url));
const manifest = { schemaVersion: 1, name: 'Local suite', cases: [{ id: 'home', source: 'http://127.0.0.1:4100/a', target: 'http://127.0.0.1:4101/a' }] };
const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10000 });
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'clone-suite-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const config = path.join(dir, 'suite config.json'); const out = path.join(dir, 'output');
  await writeFile(config, JSON.stringify(manifest)); return { dir, config, out };
}

test('suite help needs no manifest or browser', () => { const r = run(['--help']); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /--dry-run/); });
test('dry-run validates and prints the plan without creating output', async t => {
  const { config, out } = await fixture(t); const r = run(['--config', config, '--out', out, '--dry-run', '--target-origin', 'http://127.0.0.1:4200']);
  assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).cases[0].target, 'http://127.0.0.1:4200/a');
  await assert.rejects(access(out));
});
test('dry-run does not require --out', async t => { const { config } = await fixture(t); const r = run(['--config', config, '--dry-run']); assert.equal(r.status, 0, r.stderr); });
test('ordinary execution requires --out before starting browsers', async t => { const { config } = await fixture(t); const r = run(['--config', config]); assert.equal(r.status, 1); assert.match(r.stderr, /--out/); });
test('unknown config keys fail before output is created', async t => {
  const { config, out } = await fixture(t); await writeFile(config, JSON.stringify({ ...manifest, typo: true }));
  const r = run(['--config', config, '--out', out]); assert.equal(r.status, 1); assert.match(r.stderr, /unknown field/); await assert.rejects(access(out));
});
test('unknown selected cases fail before output is created', async t => {
  const { config, out } = await fixture(t); const r = run(['--config', config, '--out', out, '--only', 'missing']);
  assert.equal(r.status, 1); assert.match(r.stderr, /Unknown case/); await assert.rejects(access(out));
});
test('malformed and oversized manifests are rejected', async t => {
  const { config, out } = await fixture(t); await writeFile(config, '{');
  assert.equal(run(['--config', config, '--out', out]).status, 1); await assert.rejects(access(out));
  await writeFile(config, ' '.repeat(1000001)); const r = run(['--config', config, '--dry-run']);
  assert.equal(r.status, 1); assert.match(r.stderr, /1 MB/);
});
test('overwrite never removes a manifest stored under its output', async t => {
  const { dir, config } = await fixture(t); const original = await readFile(config, 'utf8');
  await writeFile(path.join(dir, '.website-cloner-output.json'), JSON.stringify({ schema: 'website-cloner-output/v1', tool: 'verify-suite' }));
  const r = run(['--config', config, '--out', dir, '--overwrite']); assert.equal(r.status, 1); assert.match(r.stderr, /input file/);
  assert.equal(await readFile(config, 'utf8'), original);
});
test('overwrite refuses non-owned directories', async t => {
  const { config, out } = await fixture(t); await mkdir(out); await writeFile(path.join(out, 'keep.txt'), 'do not remove');
  const r = run(['--config', config, '--out', out, '--overwrite']); assert.equal(r.status, 1);
  assert.match(r.stderr, /not owned/); assert.equal(await readFile(path.join(out, 'keep.txt'), 'utf8'), 'do not remove');
});
