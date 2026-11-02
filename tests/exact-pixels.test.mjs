import test from 'node:test';
import assert from 'node:assert/strict';
let lib = {};
try { lib = await import('../scripts/lib/exact-pixels.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const measure = (...args) => {
  assert.equal(typeof lib.measureExactPixels, 'function', 'Exact RGBA measurement must exist');
  return lib.measureExactPixels(...args);
};
const pixels = (...values) => Uint8Array.from(values.flat());
const same = pixels([255,255,255,255], [255,255,255,255]);

test('exact equality measures decoded RGBA, preserving both input arrays', () => {
  const copy = same.slice(); const mask = new Uint8Array(8).fill(71);
  const result = measure(same, copy, 2, 1, mask);
  assert.equal(result.method, 'decoded-rgba8'); assert.equal(result.schemaVersion, 1);
  assert.equal(result.identical, true); assert.equal(result.changedPixels, 0);
  assert.equal(result.changedPixelRatio, 0); assert.equal(result.totalPixels, 2);
  assert.equal(result.maxChannelDelta, 0); assert.equal(result.meanAbsoluteChannelDelta, 0);
  assert.equal(result.bounds, null);
  assert.deepEqual(mask, pixels([0,0,0,255], [0,0,0,255]));
  assert.deepEqual(copy, same);
});
test('one channel changing by one is one different pixel, not zero or four', () => {
  const target = same.slice(); target[4] = 254; const mask = new Uint8Array(8);
  const result = measure(same, target, 2, 1, mask);
  assert.equal(result.changedPixels, 1); assert.equal(result.changedPixelRatio, 0.5);
  assert.equal(result.identical, false); assert.equal(result.maxChannelDelta, 1);
  assert.equal(result.meanAbsoluteChannelDelta, 1/8);
  assert.deepEqual(result.bounds, {x:1, y:0, width:1, height:1});
  assert.deepEqual(mask, pixels([0,0,0,255], [255,255,255,255]));
});
test('separate changed pixels produce inclusive bounds and correct delta statistics', () => {
  const a = new Uint8Array(24); const b = a.slice(); b[4] = 12; b[23] = 4;
  const result = measure(a, b, 3, 2);
  assert.equal(result.changedPixels, 2); assert.equal(result.totalPixels, 6);
  assert.deepEqual(result.bounds, {x:1, y:0, width:2, height:2});
  assert.equal(result.meanAbsoluteChannelDelta, 16/24); assert.equal(result.maxChannelDelta, 12);
});
for (const [name, a, b] of [
  ['alpha-only', [40,50,60,255], [40,50,60,254]],
  ['invisible RGB under zero alpha', [40,50,60,0], [41,50,60,0]],
]) test(`exact measurement includes ${name}`, () => {
  assert.equal(measure(pixels(a),pixels(b),1,1).changedPixels,1);
});
test('typed-array subviews are respected instead of reading their entire backing buffer', () => {
  const a = pixels([9,9,9,9], [1,2,3,4], [8,8,8,8]);
  assert.equal(measure(a.subarray(4,8),pixels([1,2,3,4]),1,1).identical,true);
});
for (const [name, args] of [
  ['zero dimension', [same,same,0,1]], ['fractional dimension', [same,same,2.5,1]],
  ['oversized image', [same,same,100000001,1]], ['wrong length', [same,same,2,2]],
  ['non-byte array', [[1,2,3,4],pixels([1,2,3,4]),1,1]],
  ['wrong mask length', [same,same,2,1,new Uint8Array(4)]],
  ['aliased output', [same,same,2,1,same]],
]) test(`exact measurement rejects ${name}`, () => {
  assert.equal(typeof lib.measureExactPixels,'function','Exact RGBA measurement must exist');
  assert.throws(()=>lib.measureExactPixels(...args), /RGBA|dimension|pixel|mask|overlap|byte/i);
});
test('metric validator rejects inconsistency instead of displaying false equality', () => {
  assert.equal(typeof lib.validateExactPixels,'function');
  const target=same.slice(); target[0]=254; const good=measure(same,target,2,1);
  assert.deepEqual(lib.validateExactPixels(good,2,1),good);
  for (const change of [
    {identical:true}, {changedPixelRatio:0}, {changedPixels:-1}, {totalPixels:3},
    {width:3}, {method:'anything'}, {maxChannelDelta:256}, {meanAbsoluteChannelDelta:NaN},
    {bounds:null}, {bounds:{x:2,y:0,width:1,height:1}},
  ]) assert.throws(()=>lib.validateExactPixels({...good,...change},2,1), /exact|RGBA|metric/i);
});
