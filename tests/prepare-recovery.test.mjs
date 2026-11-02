import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareProject } from '../scripts/lib/prepare-project.mjs';
import { executeNodeScript } from '../scripts/lib/suite-runner.mjs';
import { captureFixture, successful } from './helpers/preparation-fixture.mjs';
async function fixture(t) { const dir = await mkdtemp(path.join(tmpdir(), 'cloner-prepare-recovery-')); t.after(() => rm(dir, { recursive: true, force: true })); return { dir, source: 'https://source.test/', target: 'http://127.0.0.1:9/', out: path.join(dir, 'out'), widths: '120', height: '80' }; }
test('running journal records network permission before launching the capture', async t => {
  const f = await fixture(t); let journal;
  await prepareProject(f, { execute: async (...args) => { journal = JSON.parse(await readFile(path.join(f.out, 'preparation.json'))); return captureFixture(...args); } });
  assert.equal(journal.status, 'running'); assert.equal(journal.stages[1].status, 'running'); assert.equal(journal.networkAccess, true);
});
test('custom capture deadline is forwarded and persisted logs remain bounded', async t => {
  const f = await fixture(t); let deadline;
  const r = await prepareProject({ ...f, timeoutMs: 42000 }, { execute: async (s, a, o) => { deadline = o.timeoutMs; await captureFixture(s, a, o); return { ...successful(), stdout: 'x'.repeat(20000), stderr: 'y'.repeat(20000) }; } });
  assert.equal(deadline, 42000); assert.equal(r.timeoutMs, 42000); assert.equal(r.status, 'prepared');
  for (const stream of ['stdout', 'stderr']) assert.equal((await readFile(path.join(f.out, `logs/capture.${stream}.log`), 'utf8')).length, 12000);
});
test('an actual hanging child process is killed and preparation remains failed', { timeout: 10000 }, async t => {
  const f = await fixture(t), script = path.join(f.dir, 'hang.mjs'); await writeFile(script, 'setInterval(() => {}, 1000);\n');
  const r = await prepareProject({ ...f, timeoutMs: 1000 }, { execute: (_script, _args, options) => executeNodeScript(script, [], options) });
  assert.equal(r.status, 'failed'); assert.equal(r.captureCommand.timedOut, true); assert.equal(r.stages[1].status, 'failed'); assert.equal(r.stages[2].status, 'not_started');
});
test('an aliased parent resolves to a new canonical workspace', async t => {
  const f = await fixture(t), parent = path.join(f.dir, 'real'), alias = path.join(f.dir, 'alias'); await mkdir(parent); await symlink(parent, alias);
  const r = await prepareProject({ ...f, out: path.join(alias, 'new') }, { execute: captureFixture }); assert.equal(r.destination, path.join(parent, 'new')); assert.equal(r.status, 'prepared');
});
test('missing viewport PNG after a zero capture exit preserves failed source evidence', async t => {
  const f = await fixture(t); const r = await prepareProject(f, { execute: async (...args) => { await captureFixture(...args); await rm(path.join(f.out, 'source/120x80/viewport.png')); return successful(); } });
  assert.equal(r.status, 'failed'); assert.equal(r.stages[1].status, 'failed'); assert.match(r.stages[1].error, /viewport.png/);
});
test('handoff file is exclusive even if another writer creates it during capture', async t => {
  const f = await fixture(t); const r = await prepareProject(f, { execute: async (...args) => { await captureFixture(...args); await writeFile(path.join(f.out, 'START-HERE.md'), 'retain user file'); return successful(); } });
  assert.equal(r.status, 'failed'); assert.equal(r.stages[3].status, 'failed'); assert.equal(await readFile(path.join(f.out, 'START-HERE.md'), 'utf8'), 'retain user file');
});
