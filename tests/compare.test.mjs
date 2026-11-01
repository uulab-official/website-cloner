import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstat, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));

// Small real PNG fixtures are encoded with Node's standard library so CLI
// validation tests do not depend on the implementation's decoder or helpers.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, bytes) {
  const kind = Buffer.from(type);
  const result = Buffer.alloc(bytes.length + 12);
  result.writeUInt32BE(bytes.length, 0);
  kind.copy(result, 4);
  bytes.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([kind, bytes])), bytes.length + 8);
  return result;
}

async function writePng(filename, width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) Buffer.from(rgba).copy(rows, y * (1 + width * 4) + 1 + x * 4);
  }
  await writeFile(filename, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0)),
  ]));
}

function compare(source, target, out, ...extra) {
  return spawnSync(process.execPath, [
    path.join(root, 'scripts', 'compare.mjs'), '--source', source, '--target', target, '--out', out, ...extra,
  ], { cwd: root, encoding: 'utf8', timeout: 10_000 });
}

async function fixture(t) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'cloner-compare-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  return { temp, source: path.join(temp, 'source.png'), target: path.join(temp, 'target.png'), out: path.join(temp, 'out') };
}

async function report(out) {
  return JSON.parse(await readFile(path.join(out, 'report.json'), 'utf8'));
}

test('identical real PNGs report zero changes and create correctly sized visual artifacts', async (t) => {
  const { source, target, out } = await fixture(t);
  await writePng(source, 2, 3, [255, 255, 255, 255]);
  await writePng(target, 2, 3, [255, 255, 255, 255]);
  const result = compare(source, target, out);
  assert.equal(result.status, 0, result.stderr);
  const data = await report(out);
  assert.equal(data.changedPixels, 0);
  assert.equal(data.changedPixelRatio, 0);
  assert.equal(data.totalPixels, 6);
  assert.equal(data.pixelmatchThreshold, 0.1);
  assert.equal(data.maxDiffRatio, null);
  assert.equal(data.passed, null, 'No default quality approval is implied');
  assert.match(data.interpretation, /semantic/i);
  const diff = await readFile(path.join(out, 'diff.png'));
  const beside = await readFile(path.join(out, 'side-by-side.png'));
  assert.deepEqual([diff.readUInt32BE(16), diff.readUInt32BE(20)], [2, 3]);
  assert.deepEqual([beside.readUInt32BE(16), beside.readUInt32BE(20)], [4, 3]);
});

test('different PNGs remain diagnostic unless an explicit maximum ratio is supplied', async (t) => {
  const { source, target, out } = await fixture(t);
  await writePng(source, 2, 2, [0, 0, 0, 255]);
  await writePng(target, 2, 2, [255, 255, 255, 255]);
  const result = compare(source, target, out);
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await report(out)).changedPixelRatio, 1);
  const limited = compare(source, target, out, '--max-diff-ratio', '0.5', '--overwrite');
  assert.equal(limited.status, 1, limited.stderr);
  const data = await report(out);
  assert.equal(data.changedPixels, 4);
  assert.equal(data.maxDiffRatio, 0.5);
  assert.equal(data.passed, false);
  assert.equal(data.status, 'threshold_exceeded');
});

test('an explicit zero threshold accepts identical images', async (t) => {
  const { source, target, out } = await fixture(t);
  await writePng(source, 1, 1, [120, 20, 30, 255]);
  await writePng(target, 1, 1, [120, 20, 30, 255]);
  const result = compare(source, target, out, '--max-diff-ratio', '0');
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await report(out)).passed, true);
});

test('different dimensions are recorded as a failure without resizing or inventing a ratio', async (t) => {
  const { source, target, out } = await fixture(t);
  await writePng(source, 2, 2, [0, 0, 0, 255]);
  await writePng(target, 3, 2, [0, 0, 0, 255]);
  const result = compare(source, target, out);
  assert.equal(result.status, 1, result.stderr);
  const data = await report(out);
  assert.equal(data.status, 'dimension_mismatch');
  assert.equal(data.passed, false);
  assert.equal(data.changedPixelRatio, null);
  assert.deepEqual(data.dimensions, { source: { width: 2, height: 2 }, target: { width: 3, height: 2 } });
  assert.equal((await readdir(out)).includes('diff.png'), false);
});

test('an existing evidence run is protected until explicit overwrite', async (t) => {
  const { source, target, out } = await fixture(t);
  await writePng(source, 2, 2, [0, 0, 0, 255]);
  await writePng(target, 2, 2, [0, 0, 0, 255]);
  assert.equal(compare(source, target, out).status, 0);
  const originalReport = await readFile(path.join(out, 'report.json'), 'utf8');
  await writePng(target, 2, 2, [255, 255, 255, 255]);
  const protectedRun = compare(source, target, out);
  assert.notEqual(protectedRun.status, 0);
  assert.match(protectedRun.stderr, /nonempty|non-empty|overwrite/i);
  assert.equal(await readFile(path.join(out, 'report.json'), 'utf8'), originalReport);
  assert.equal(compare(source, target, out, '--overwrite').status, 0);
  assert.equal((await report(out)).changedPixelRatio, 1);
});

test('overwrite cannot delete an input contained in the output run', async (t) => {
  const { source, target, out } = await fixture(t);
  await writePng(source, 2, 2, [0, 0, 0, 255]);
  await writePng(target, 2, 2, [0, 0, 0, 255]);
  assert.equal(compare(source, target, out).status, 0);
  const nestedInput = path.join(out, 'diff.png');
  const original = await readFile(nestedInput);
  const result = compare(nestedInput, target, out, '--overwrite');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /contain|input|source/i);
  assert.deepEqual(await readFile(nestedInput), original);
});

test('a symlink cannot redirect output writes or overwrite a different directory', async (t) => {
  const { temp, source, target, out } = await fixture(t);
  await writePng(source, 2, 2, [0, 0, 0, 255]);
  await writePng(target, 2, 2, [0, 0, 0, 255]);
  assert.equal(compare(source, target, out).status, 0);
  const linkedOutput = path.join(temp, 'linked-output');
  await symlink(out, linkedOutput, 'dir');
  const originalReport = await readFile(path.join(out, 'report.json'), 'utf8');
  const result = compare(source, target, linkedOutput, '--overwrite');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /symlink|symbolic/i);
  assert.equal(await readFile(path.join(out, 'report.json'), 'utf8'), originalReport);
});

test('overwrite protects an input symlink inside output even when its target is elsewhere', async (t) => {
  const { source, target, out } = await fixture(t);
  await writePng(source, 2, 2, [0, 0, 0, 255]);
  await writePng(target, 2, 2, [0, 0, 0, 255]);
  assert.equal(compare(source, target, out).status, 0);
  const linkedInput = path.join(out, 'input.png');
  await symlink(source, linkedInput);
  const result = compare(linkedInput, target, out, '--overwrite');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /contain|input|source/i);
  assert.equal((await lstat(linkedInput)).isSymbolicLink(), true);
});

test('a symlinked parent cannot hide an input entry inside the output run', async (t) => {
  const { temp, source, target, out } = await fixture(t);
  await writePng(source, 2, 2, [0, 0, 0, 255]);
  await writePng(target, 2, 2, [0, 0, 0, 255]);
  assert.equal(compare(source, target, out).status, 0);
  const linkedInput = path.join(out, 'input.png');
  await symlink(source, linkedInput);
  const parentAlias = path.join(temp, 'alias');
  await symlink(temp, parentAlias, 'dir');
  const result = compare(linkedInput, target, path.join(parentAlias, 'out'), '--overwrite');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /contain|input|source/i);
  assert.equal((await lstat(linkedInput)).isSymbolicLink(), true);
});

test('malformed PNG data produces a nonzero result and a diagnostic report', async (t) => {
  const { source, target, out } = await fixture(t);
  await writeFile(source, 'not a PNG');
  await writePng(target, 2, 2, [0, 0, 0, 255]);
  const result = compare(source, target, out);
  assert.notEqual(result.status, 0);
  assert.equal((await report(out)).status, 'invalid_data');
});
