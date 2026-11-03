import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Every destructive scenario is confined to a disposable fixture. No real
// repository output, source, or personal file is used as a cleanup target.
const repo = fileURLToPath(new URL('../', import.meta.url));
const vite = path.join(repo, 'node_modules/vite/bin/vite.js');
async function fixture(action) {
  const root = await mkdtemp(path.join(tmpdir(), 'cloner-build-policy-'));
  try {
    const example = path.join(root, 'examples/uulab-services');
    await mkdir(path.join(example, 'services'), { recursive: true });
    await mkdir(path.join(example, 'home')); 
    await mkdir(path.join(example, 'src'));
    await mkdir(path.join(root, 'dist/other'), { recursive: true });
    await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
    await symlink(path.join(repo, 'node_modules'), path.join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    await cp(path.join(repo, 'examples/uulab-services/vite.config.js'), path.join(example, 'vite.config.js'));
    try { await cp(path.join(repo, 'examples/uulab-services/build-policy.mjs'), path.join(example, 'build-policy.mjs')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await writeFile(path.join(example, 'src/render.js'), 'export const renderPage = () => "<main>Build fixture</main>";');
    for (const entry of ['index.html', 'services/index.html', 'home/index.html']) {
      await writeFile(path.join(example, entry), '<!doctype html><html><body><!-- uulab:page --></body></html>');
    }
    await writeFile(path.join(root, 'dist/other/keep.txt'), 'sibling');
    const build = (...args) => {
      const result = spawnSync(process.execPath, [vite, 'build', 'examples/uulab-services', '--outDir', '../../dist/demo', ...args], { cwd: root, encoding: 'utf8', timeout: 30000 });
      assert.ifError(result.error);
      return { ...result, output: result.stdout + result.stderr };
    };
    await action({ root, example, build });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('clean rebuild removes stale demo files, preserves sibling output and emits no outside-root warning', async () => {
  await fixture(async ({ root, build }) => {
    let result = build();
    assert.equal(result.status, 0, result.output);
    await writeFile(path.join(root, 'dist/demo/stale.js'), 'old output');
    result = build();
    assert.equal(result.status, 0, result.output);
    assert.doesNotMatch(result.output.replace(/\u001b\[[0-9;]*m/g, ''), /outDir.*(?:outside|not inside)|outside of project root/i);
    await assert.rejects(readFile(path.join(root, 'dist/demo/stale.js')), { code: 'ENOENT' });
    assert.equal(await readFile(path.join(root, 'dist/other/keep.txt'), 'utf8'), 'sibling');
    for (const entry of ['index.html', 'services/index.html', 'home/index.html']) {
      assert.match(await readFile(path.join(root, 'dist/demo', entry), 'utf8'), /Build fixture/);
    }
  });
});
for (const target of ['../..', '../../dist', '../../dist/other', 'src']) {
  test(`rejects --outDir ${target} before emptying any directory`, async () => {
    await fixture(async ({ root, example, build }) => {
      const sentinel = path.join(path.resolve(example, target), 'keep.txt');
      await writeFile(sentinel, 'must survive');
      const result = build('--outDir', target, '--emptyOutDir');
      assert.notEqual(result.status, 0, result.output);
      assert.match(result.output, /Unsafe demo build output/);
      assert.equal(await readFile(sentinel, 'utf8'), 'must survive');
    });
  });
}
for (const linked of ['dist', 'dist/demo']) {
  test(`rejects a symlink at ${linked} before touching its target`, async () => {
    await fixture(async ({ root, build }) => {
      const target = path.join(root, 'protected');
      await mkdir(target); await writeFile(path.join(target, 'keep.txt'), 'protected');
      const link = path.join(root, linked);
      await rm(link, { recursive: true, force: true });
      await symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
      const result = build();
      assert.notEqual(result.status, 0, result.output);
      assert.match(result.output, /Unsafe demo build output/);
      assert.equal(await readFile(path.join(target, 'keep.txt'), 'utf8'), 'protected');
    });
  });
}
