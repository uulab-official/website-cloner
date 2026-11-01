import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));

function cli(name, args) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', `${name}.mjs`), ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '/nonexistent-browser-for-validation-tests' },
  });
}

for (const name of ['capture', 'compare']) {
  test(`${name} --help succeeds without browser installation or required arguments`, () => {
    const result = cli(name, ['--help']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /--out/);
  });

  test(`${name} rejects unknown flags before doing work`, () => {
    const result = cli(name, ['--invented-option', 'yes']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown.*--invented-option/i);
    assert.doesNotMatch(result.stderr, /browserType\.launch|executable doesn't exist/i);
  });
}

const invalidCaptureCases = [
  ['URL scheme', ['--url', 'file:///tmp/page.html'], /http|https/i],
  ['embedded credentials', ['--url', 'https://name:secret@example.com'], /credentials/i],
  ['invalid URL', ['--url', 'not-a-url'], /url/i],
  ['zero width', ['--widths', '0'], /width/i],
  ['nonfinite width', ['--widths', 'Infinity'], /width/i],
  ['fractional width', ['--widths', '390.5'], /width/i],
  ['empty width', ['--widths', '1440,,390'], /width/i],
  ['duplicate width', ['--widths', '390,390'], /width/i],
  ['excessive width', ['--widths', '999999'], /width/i],
  ['zero height', ['--height', '0'], /height/i],
  ['noninteger height', ['--height', '900px'], /height/i],
  ['invalid scheme', ['--scheme', 'sepia'], /scheme/i],
  ['duplicate flag', ['--height', '900', '--height', '900'], /duplicate/i],
];

for (const [name, replacement, pattern] of invalidCaptureCases) {
  test(`capture rejects ${name} before browser launch`, () => {
    const flags = ['--url', 'https://example.com', '--out', '/tmp/unused-capture-test'];
    const index = flags.indexOf(replacement[0]);
    if (index !== -1) flags.splice(index, 2);
    const result = cli('capture', [...flags, ...replacement]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, pattern);
    assert.doesNotMatch(result.stderr, /browserType\.launch|executable doesn't exist/i);
  });
}

test('capture reports missing option values and missing required options', () => {
  for (const args of [['--url'], ['--url', '--out', 'evidence'], ['--url', 'https://example.com']]) {
    const result = cli('capture', args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /required|value|missing/i);
  }
});

test('capture accepts only the documented action objects before browser launch', async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'cloner-actions-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  for (const [index, actions] of [
    { type: 'click', selector: 'button' },
    [{ type: 'evaluate', script: 'alert(1)' }],
    [{ type: 'click', selector: 'button', script: 'alert(1)' }],
    [{ type: 'scroll', selector: '' }],
  ].entries()) {
    const actionsPath = path.join(temp, `actions-${index}.json`);
    await writeFile(actionsPath, JSON.stringify(actions));
    const result = cli('capture', [
      '--url', 'https://example.com', '--out', path.join(temp, 'out'), '--actions', actionsPath,
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /actions|selector/i);
    assert.doesNotMatch(result.stderr, /browserType\.launch|executable doesn't exist/i);
  }
});

test('capture refuses an unowned nonempty output directory even with overwrite', async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'cloner-output-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const sentinel = path.join(temp, 'keep.txt');
  await writeFile(sentinel, 'keep this evidence');
  const result = cli('capture', [
    '--url', 'https://example.com', '--out', temp, '--overwrite',
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /output|nonempty|non-empty|owned/i);
  assert.equal(await readFile(sentinel, 'utf8'), 'keep this evidence');
  assert.doesNotMatch(result.stderr, /browserType\.launch|executable doesn't exist/i);
});

test('capture cannot overwrite a supplied executable inside its evidence directory', async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'cloner-executable-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const out = path.join(temp, 'out');
  const failedLaunch = cli('capture', [
    '--url', 'https://example.com', '--out', out, '--executable-path', path.join(temp, 'missing-browser'),
  ]);
  assert.notEqual(failedLaunch.status, 0);
  const executable = path.join(out, 'browser');
  await writeFile(executable, 'must not be deleted');
  const result = cli('capture', [
    '--url', 'https://example.com', '--out', out, '--executable-path', executable, '--overwrite',
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /contain|input|executable/i);
  assert.equal(await readFile(executable, 'utf8'), 'must not be deleted');
});

test('capture --keep-scroll is boolean and rejects a supplied value', () => {
  const result = cli('capture', ['--url', 'https://example.com', '--out', '/tmp/unused-capture-test', '--keep-scroll=false']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not take a value/i);
});

for (const value of ['-0.1', '1.1', 'NaN', '2x', '']) {
  test(`compare rejects invalid --max-diff-ratio ${JSON.stringify(value)}`, () => {
    const result = cli('compare', [
      '--source', 'source.png', '--target', 'target.png', '--out', 'output', '--max-diff-ratio', value,
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /max-diff-ratio|ratio/i);
  });
}

test('capture records real local browser evidence at two widths and performs only supplied actions', {
  skip: !process.env.CAPTURE_TEST_EXECUTABLE_PATH && !process.env.CAPTURE_TEST_BUNDLED_BROWSER,
  timeout: 90_000,
}, async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'cloner-browser-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const server = createServer((request, response) => {
    if (request.url === '/slow.svg') {
      setTimeout(() => {
        response.writeHead(200, { 'Content-Type': 'image/svg+xml' }).end('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>');
      }, 2000);
      return;
    }
    if (request.url === '/missing.png') {
      response.writeHead(404).end('missing');
      return;
    }
    response.setHeader('Content-Type', 'text/html');
    response.end(`<!doctype html><html><head><title>Local capture fixture</title>
      <style>body{margin:0;font:18px Arial,sans-serif}h1{font-size:40px}main{min-height:4200px}
      [hidden]{display:none}.wide{width:1600px}button{font:inherit}
      @keyframes shift{from{transform:translateX(0)}to{transform:translateX(80px)}}
      @keyframes cycle{from{transform:translateX(60px)}to{transform:translateX(80px)}}
      #animated{animation:shift 120s linear forwards}
      #infinite{transform:translateX(20px);animation:cycle 120s linear infinite}</style></head>
      <body><header><h1>Fixture heading</h1><button id="open" onclick="document.querySelector('#menu').hidden=false">Open menu</button>
      <nav id="menu" hidden><a href="/about">Menu destination</a></nav></header>
      <main><h2 id="animated">Animated heading</h2><h2 id="infinite">Infinite animation heading</h2><p>Visible evidence text</p><img src="/missing.png" alt="Broken evidence image"><div class="wide">Overflow evidence</div></main>
      <footer id="footer">Footer evidence<img src="/slow.svg" loading="lazy" width="10" height="10" alt="Slow lazy image"></footer><script>console.error('fixture console error');
      window.addEventListener('load',()=>setTimeout(()=>{throw new Error('fixture page error')},10));</script></body></html>`);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const actions = path.join(temp, 'actions.json');
  await writeFile(actions, JSON.stringify([{ type: 'click', selector: '#open' }, { type: 'scroll', selector: '#footer' }]));
  const out = path.join(temp, 'out');
  const args = [
    path.join(root, 'scripts', 'capture.mjs'), '--url', `http://127.0.0.1:${server.address().port}/`,
    '--out', out, '--widths', '800,390', '--height', '600', '--scheme', 'dark', '--state', 'menu-open', '--actions', actions,
  ];
  if (process.env.CAPTURE_TEST_EXECUTABLE_PATH) args.push('--executable-path', process.env.CAPTURE_TEST_EXECUTABLE_PATH);
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env } });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdout.resume();
  const [status] = await once(child, 'exit');
  assert.equal(status, 0, stderr);
  const manifest = JSON.parse(await readFile(path.join(out, 'capture.json'), 'utf8'));
  assert.equal(manifest.status, 'completed');
  assert.equal(manifest.captures.length, 2);
  for (const width of [800, 390]) {
    const directory = path.join(out, `${width}x600`);
    const data = JSON.parse(await readFile(path.join(directory, 'page.json'), 'utf8'));
    assert.equal(data.title, 'Local capture fixture');
    assert.equal(data.viewport.width, width);
    assert.equal(data.scheme, 'dark');
    assert.equal(data.reducedMotion, 'reduce');
    assert.equal(data.state, 'menu-open');
    assert.equal(data.scrollState.atCapture.y, 0);
    assert.equal(data.actions.length, 2);
    assert.equal(data.actions.every((action) => action.status === 'completed'), true);
    assert.ok(data.headings.some((heading) => heading.text === 'Fixture heading' && heading.typography.fontSize === '40px'));
    assert.match(data.visibleText.text, /Visible evidence text/);
    assert.ok(data.links.some((link) => link.text === 'Menu destination'));
    assert.ok(data.images.some((image) => image.alt === 'Broken evidence image' && image.naturalWidth === 0));
    assert.ok(data.images.some((image) => image.alt === 'Slow lazy image' && image.naturalWidth === 10));
    assert.equal(data.headings.find((heading) => heading.text === 'Animated heading').geometry.x, 80);
    assert.equal(data.headings.find((heading) => heading.text === 'Infinite animation heading').geometry.x, 20);
    assert.equal(data.overflow.horizontal, true);
    assert.ok(data.consoleErrors.some((error) => error.text.includes('fixture console error')));
    assert.ok(data.pageErrors.some((error) => error.message.includes('fixture page error')));
    assert.ok(data.failedResponses.some((failure) => failure.status === 404));
    const viewport = await readFile(path.join(directory, 'viewport.png'));
    const fullPage = await readFile(path.join(directory, 'full-page.png'));
    assert.deepEqual([viewport.readUInt32BE(16), viewport.readUInt32BE(20)], [width, 600]);
    assert.ok(fullPage.readUInt32BE(20) > 600);
  }

  const keptOut = path.join(temp, 'kept-scroll');
  const keptArgs = [...args];
  keptArgs[keptArgs.indexOf('--out') + 1] = keptOut;
  keptArgs[keptArgs.indexOf('--widths') + 1] = '390';
  keptArgs.push('--keep-scroll');
  const keptChild = spawn(process.execPath, keptArgs, { cwd: root, env: { ...process.env } });
  let keptError = '';
  keptChild.stdout.resume();
  keptChild.stderr.on('data', (chunk) => { keptError += chunk; });
  const [keptStatus] = await once(keptChild, 'exit');
  assert.equal(keptStatus, 0, keptError);
  const keptRecord = JSON.parse(await readFile(path.join(keptOut, '390x600', 'page.json'), 'utf8'));
  assert.ok(keptRecord.scrollState.atCapture.y > 0, 'Explicit scroll state must survive into the viewport screenshot');
  assert.equal(keptRecord.scrollState.keepScroll, true);
});

test('capture preserves a diagnostic record and fails for a main document HTTP error', {
  skip: !process.env.CAPTURE_TEST_EXECUTABLE_PATH && !process.env.CAPTURE_TEST_BUNDLED_BROWSER,
  timeout: 45_000,
}, async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'cloner-http-error-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const server = createServer((_request, response) => {
    response.writeHead(503, { 'Content-Type': 'text/html' }).end('<title>Unavailable</title><h1>Unavailable</h1>');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const out = path.join(temp, 'out');
  const args = [path.join(root, 'scripts', 'capture.mjs'), '--url', `http://127.0.0.1:${server.address().port}/`, '--out', out, '--widths', '390'];
  if (process.env.CAPTURE_TEST_EXECUTABLE_PATH) args.push('--executable-path', process.env.CAPTURE_TEST_EXECUTABLE_PATH);
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env } });
  child.stdout.resume();
  child.stderr.resume();
  const [status] = await once(child, 'exit');
  assert.equal(status, 1);
  const manifest = JSON.parse(await readFile(path.join(out, 'capture.json'), 'utf8'));
  assert.equal(manifest.status, 'failed');
  const data = JSON.parse(await readFile(path.join(out, '390x900', 'page.json'), 'utf8'));
  assert.equal(data.status, 'failed');
  assert.equal(data.screenshots.viewport, null);
  assert.equal(data.screenshots.fullPage, null);
  assert.ok(data.failedResponses.some((response) => response.status === 503));
});
