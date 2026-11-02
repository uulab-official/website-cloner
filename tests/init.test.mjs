import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, writeFile, mkdir, symlink, lstat, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSuite } from '../scripts/lib/suite-config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = path.join(root, 'scripts/init.mjs');
const impl = await import('../scripts/lib/project-init.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const sample = { source: 'https://source.invalid/services/?lang=ko', target: 'http://127.0.0.1:4173/rebuilt/?lang=ko' };
function plan(options = {}) {
  assert.equal(typeof impl.planProject, 'function', 'project planner must be implemented');
  return impl.planProject({ ...sample, ...options });
}
async function init(options) {
  assert.equal(typeof impl.initializeProject, 'function', 'project initializer must be implemented');
  return impl.initializeProject({ ...sample, ...options });
}
async function temp(t) {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'cloner-init-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
function cli(args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', timeout: 10000 });
}
const argsFor = out => ['--source', sample.source, '--target', sample.target, '--out', out];

test('planner produces the portable skill bundle with honest unverified defaults', () => {
  const p = plan();
  assert.deepEqual(Object.keys(p.files).sort(), ['HANDOFF.md', 'README.md', 'assets.json', 'report.md', 'suite.json']);
  assert.deepEqual(JSON.parse(p.files['assets.json']), { schema_version: 1, assets: [] });
  const suite = JSON.parse(p.files['suite.json']);
  assert.equal(suite.schemaVersion, 1);
  assert.equal(suite.sourceOrigin, 'https://source.invalid');
  assert.equal(suite.targetOrigin, 'http://127.0.0.1:4173');
  assert.deepEqual(suite.defaults.widths, [1440, 768, 390]);
  assert.equal(suite.defaults.height, 900);
  assert.equal(suite.defaults.maxDiffRatio, null);
  assert.deepEqual(suite.cases, [{ id: 'page', path: '/services/?lang=ko', targetPath: '/rebuilt/?lang=ko' }]);
  for (const heading of ['Scope', 'Routes', 'Views and states', 'Measurements', 'Behavior', 'Checks', 'Gaps']) {
    assert.ok(p.files['report.md'].includes(`## ${heading}`));
  }
  assert.match(p.files['report.md'], /not_verified/);
  assert.match(p.files['HANDOFF.md'], /untrusted/i);
  assert.match(p.files['HANDOFF.md'], /existing framework/i);
  assert.match(p.files['README.md'], /not an application/i);
  assert.match(p.files['README.md'], /query strings/i);
});
test('planner accepts explicit viewport settings without injecting a pass threshold', () => {
  const suite = JSON.parse(plan({ widths: '390,1440', height: '800' }).files['suite.json']);
  assert.deepEqual(suite.defaults.widths, [390, 1440]);
  assert.equal(suite.defaults.height, 800);
  assert.equal(suite.defaults.maxDiffRatio, null);
});
test('URL authority and Unicode path canonicalization preserves query and route mapping', () => {
  const suite = JSON.parse(plan({ source: 'https://EXAMPLE.invalid:443/한글/?q=a%20b&n=2', target: 'http://localhost:5173/?q=a%20b&n=2' }).files['suite.json']);
  assert.equal(suite.sourceOrigin, 'https://example.invalid');
  assert.equal(suite.cases[0].path, '/%ED%95%9C%EA%B8%80/?q=a%20b&n=2');
  assert.equal(suite.cases[0].targetPath, '/?q=a%20b&n=2');
});
const invalidUrls = [
  'file:///tmp/source', 'ftp://source.invalid/', 'not-a-url',
  'https://user:password@source.invalid/', 'https://source.invalid/#faq',
  'https://source.invalid/a/../b', 'https://source.invalid/%2e%2e/b',
  'https://source.invalid/a\\b', 'https://source.invalid/a%5cb',
  'https://source.invalid/a\nb', 'https://source.invalid/a%0ab',
  ' https://source.invalid/', 'https://source.invalid/ ',
  'https://source.invalid/%zz', 'https://source.invalid//elsewhere',
  'https://source.invalid/?q=' + 'a'.repeat(4100),
];
for (const source of invalidUrls) {
  test(`reject unsupported/ambiguous source ${JSON.stringify(source.slice(0, 65))}`, () => {
    assert.equal(typeof impl.planProject, 'function');
    assert.throws(() => plan({ source }));
  });
}
test('target is validated identically and secrets are not repeated in an error', () => {
  assert.equal(typeof impl.planProject, 'function');
  assert.throws(() => plan({ target: 'https://user:do-not-log-me@target.invalid/' }), error => {
    assert.doesNotMatch(error.message, /do-not-log-me/);
    return /credentials/i.test(error.message);
  });
});
for (const options of [
  { widths: '' }, { widths: '0' }, { widths: '390,390' }, { widths: '390,' },
  { widths: '1e3' }, { widths: '8193' }, { widths: '1,2,3,4,5,6,7,8,9,10,11' },
  { height: '0' }, { height: '1.5' }, { height: '8193' },
]) {
  test(`reject invalid viewport options ${JSON.stringify(options)}`, () => {
    assert.equal(typeof impl.planProject, 'function');
    assert.throws(() => plan(options));
  });
}
test('URL-like shell and Markdown data stay in JSON, never in generated instructions', () => {
  const source = 'https://source.invalid/?q=`touch${IFS}oops`&html=<script>';
  const p = plan({ source });
  assert.equal(JSON.parse(p.files['suite.json']).cases[0].path, '/?q=`touch${IFS}oops`&html=%3Cscript%3E');
  for (const name of ['HANDOFF.md', 'README.md', 'report.md']) {
    assert.ok(!p.files[name].includes('touch${IFS}oops'));
    assert.ok(!p.files[name].includes('<script>'));
  }
});
test('CLI help works offline without dependencies and describes non-goals', () => {
  const result = cli(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--dry-run/);
  assert.match(result.stdout, /does not.*clone/i);
});
test('CLI validates unsupported, missing and duplicate options before writing', async t => {
  const dir = await temp(t), out = path.join(dir, 'new');
  for (const args of [[], [...argsFor(out), '--overwrite'], [...argsFor(out), '--source', sample.source], [...argsFor(out), '--dry-run=true']]) {
    const result = cli(args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /required|unknown|duplicate|value/i);
  }
  assert.deepEqual(await readdir(dir), []);
});
test('dry-run validates a nested new destination and writes no parent or files', async t => {
  const dir = await temp(t), out = path.join(dir, 'absent', 'new');
  const result = cli([...argsFor(out), '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.status, 'planned'); assert.equal(data.destination, out);
  assert.equal(data.files.length, 5); assert.equal(data.networkAccess, false);
  assert.deepEqual(await readdir(dir), []);
});
test('generated suite is directly loadable and accepted by existing suite dry-run', async t => {
  const dir = await temp(t), out = path.join(dir, 'new project');
  const result = cli(argsFor(out));
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout); assert.equal(data.status, 'created');
  const manifest = path.join(out, 'suite.json');
  const suite = await loadSuite(manifest);
  assert.equal(suite.cases[0].sourceUrl, sample.source); assert.equal(suite.cases[0].targetUrl, sample.target);
  const check = spawnSync(process.execPath, [path.join(root, 'scripts/verify-suite.mjs'), '--manifest', manifest, '--dry-run'], { encoding: 'utf8', timeout: 10000 });
  assert.equal(check.status, 0, check.stderr); assert.deepEqual((await readdir(out)).sort(), data.files.slice().sort());
});
for (const kind of ['empty directory', 'nonempty directory', 'file', 'symlink', 'dangling symlink']) {
  test(`existing ${kind} is never replaced, even in dry-run`, async t => {
    const dir = await temp(t), out = path.join(dir, 'existing');
    if (kind.endsWith('directory')) await mkdir(out);
    if (kind === 'nonempty directory') await writeFile(path.join(out, 'mine.txt'), 'keep');
    if (kind === 'file') await writeFile(out, 'keep');
    if (kind.includes('symlink')) await symlink(path.join(dir, kind === 'symlink' ? 'target' : 'absent'), out, 'dir');
    if (kind === 'symlink') await mkdir(path.join(dir, 'target'));
    for (const dryRun of [false, true]) await assert.rejects(init({ out, dryRun }), /exists|symbolic link/i);
    const stat = await lstat(out);
    if (kind.includes('symlink')) assert.ok(stat.isSymbolicLink());
    if (kind === 'nonempty directory') assert.equal(await readFile(path.join(out, 'mine.txt'), 'utf8'), 'keep');
    if (kind === 'file') assert.equal(await readFile(out, 'utf8'), 'keep');
  });
}
test('invalid source is rejected before creating any nested parent', async t => {
  const dir = await temp(t);
  await assert.rejects(init({ out: path.join(dir, 'a', 'b'), source: 'file:///tmp/no' }));
  assert.deepEqual(await readdir(dir), []);
});
test('protect toolkit paths including aliases into the scripts directory', async t => {
  const dir = await temp(t), alias = path.join(dir, 'alias');
  await symlink(path.join(root, 'scripts'), alias, 'dir');
  for (const out of [root, path.dirname(root), ...['scripts', 'tests', 'skills', 'examples', 'node_modules', 'dist', '.git', '.github'].map(name => path.join(root, name, 'init-test-must-not-exist')), path.join(alias, 'init-test-must-not-exist')]) {
    await assert.rejects(init({ out, dryRun: true }), /protected|exists|toolkit|working directory/i);
  }
});
test('existing parent aliases resolve explicitly to a safe canonical destination', async t => {
  const dir = await temp(t), target = path.join(dir, 'target'), alias = path.join(dir, 'alias');
  await mkdir(target); await symlink(target, alias, 'dir');
  const result = await init({ out: path.join(alias, 'new') });
  assert.equal(result.destination, path.join(target, 'new'));
  assert.equal((await readdir(result.destination)).length, 5);
});
test('concurrent initialization has one exclusive winner and no overwritten files', async t => {
  const dir = await temp(t), out = path.join(dir, 'new');
  function concurrent() {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script, ...argsFor(out)], { cwd: root });
      let stderr = ''; child.stderr.on('data', s => { stderr += s; }); child.stdout.resume();
      child.on('error', reject); child.on('close', code => resolve({ code, stderr }));
    });
  }
  const results = await Promise.all([concurrent(), concurrent()]);
  assert.deepEqual(results.map(r => r.code).sort(), [0, 1], JSON.stringify(results));
  assert.equal((await readdir(out)).length, 5);
  await loadSuite(path.join(out, 'suite.json'));
});
