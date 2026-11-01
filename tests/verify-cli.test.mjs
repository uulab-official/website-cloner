import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
const cli = fileURLToPath(new URL('../scripts/verify.mjs', import.meta.url));
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { timeout: 90000 });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', value => { stdout += value; });
    child.stderr.on('data', value => { stderr += value; });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}
test('verify --help explains the parity limitation', async () => {
  const result = await run(['--help']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /not.*functional|functional.*not/i);
});
for (const args of [
  ['--source', 'file:///etc/passwd'],
  ['--source', 'https://secret:password@example.test/'],
  ['--widths', '390,390'], ['--height', '0'], ['--max-diff-ratio', '2'],
  ['--scheme', 'sepia'], ['--state', 'bad\nstate'], ['--unknown'],
]) {
  test(`verify rejects ${args[0]} before creating output`, async () => {
    const temp = await mkdtemp(path.join(tmpdir(), 'verify-invalid-'));
    try {
      const out = path.join(temp, 'out');
      // Avoid duplicate URL flags so each invalid value exercises its own validation.
      const base = ['--source', 'https://example.test/', '--target', 'http://localhost:5173/', '--out', out];
      if (args[0] === '--source') base.splice(0, 2);
      const result = await run([...base, ...args]);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /HTTP|credentials|unique|integer|0 to 1|scheme|state|Unknown option/);
      await assert.rejects(access(out));
    } finally { await rm(temp, { recursive: true, force: true }); }
  });
}
test('verify refuses to overwrite a directory containing its action input', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'verify-protected-'));
  try {
    const actions = path.join(temp, 'actions.json');
    await writeFile(actions, '[]');
    await writeFile(path.join(temp, '.website-cloner-output.json'), JSON.stringify({ schema: 'website-cloner-output/v1', tool: 'verify' }));
    const result = await run(['--source', 'https://example.test/', '--target', 'http://localhost:5173/', '--out', temp, '--source-actions', actions, '--overwrite']);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /contain an input/);
    assert.equal(await readFile(actions, 'utf8'), '[]');
  } finally { await rm(temp, { recursive: true, force: true }); }
});

const browserEnabled = Boolean(process.env.CAPTURE_TEST_BUNDLED_BROWSER || process.env.CAPTURE_TEST_EXECUTABLE_PATH);
for (const failure of [false, true]) {
  test(`paired real-browser pipeline: ${failure ? 'source HTTP failure stays failed' : 'same local fixture compares without claiming parity'}`, { skip: !browserEnabled, timeout: 100000 }, async () => {
    const temp = await mkdtemp(path.join(tmpdir(), 'verify-browser-'));
    const server = createServer((req, res) => {
      res.writeHead(req.url === '/failure' ? 500 : 200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html><title>Owned fixture</title><style>body{margin:20px;font:20px sans-serif}</style><h1>Paired fixture</h1><details><summary>FAQ</summary>Answer</details></html>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const out = path.join(temp, 'run');
      const args = ['--source', `${base}/${failure ? 'failure' : ''}`, '--target', base, '--out', out, '--widths', '320', '--height', '240'];
      if (process.env.CAPTURE_TEST_EXECUTABLE_PATH) args.push('--executable-path', process.env.CAPTURE_TEST_EXECUTABLE_PATH);
      const result = await run(args);
      assert.equal(result.code, failure ? 1 : 0, result.stderr + result.stdout);
      const report = JSON.parse(await readFile(path.join(out, 'verification.json'), 'utf8'));
      assert.equal(report.status, failure ? 'failed' : 'completed');
      assert.equal(report.functionalParity, 'not_verified');
      assert.equal(report.rows[0].comparable, !failure);
      if (!failure) {
        assert.equal(report.rows[0].changedPixelRatio, 0);
        assert.equal(report.rows[0].visualGate, 'not_requested');
        await access(path.join(out, 'comparisons/320x240/side-by-side.png'));
      } else {
        await assert.rejects(access(path.join(out, 'comparisons/320x240/report.json')));
      }
      assert.match(await readFile(path.join(out, 'index.html'), 'utf8'), /not_verified/);
    } finally {
      await new Promise(resolve => server.close(resolve));
      await rm(temp, { recursive: true, force: true });
    }
  });
}
