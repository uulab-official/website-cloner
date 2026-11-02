import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const mod = await import('../scripts/lib/media-evidence.mjs').catch(e => { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e; });
function node(id, options = {}) { return { id, tagName: 'DIV', parentElement: null, querySelectorAll: () => options.sources || [], ...options }; }
function collect(elements, media = []) {
  assert.equal(typeof mod.collectMediaEvidence, 'function', 'Read-only media collector is missing');
  const document = { querySelectorAll: selector => selector === 'html, body, body *' ? elements : selector === 'video,audio' ? media : [elements[0]] };
  return JSON.parse(JSON.stringify(vm.runInNewContext(`(${mod.collectMediaEvidence.toString()})()`, {
    document, CSS: { escape: x => x }, getComputedStyle: (element, pseudo) => ({ backgroundImage: (pseudo ? element.pseudos?.[pseudo] : element.background) || 'none', content: pseudo && element.pseudos?.[pseudo] ? '""' : 'none' }), URL,
  })));
}
test('collector is standalone and records generated pseudo backgrounds without invoking network or playback', () => {
  const hero = node('hero', { background: 'url("https://a.test/bg.png")', pseudos: { '::before': 'url("https://a.test/badge.svg")' } });
  const movie = node('movie', { tagName: 'VIDEO', src: 'https://a.test/movie.mp4', currentSrc: '', poster: 'https://a.test/poster.png', sources: [node('', { src: 'https://a.test/alt.webm', type: 'video/webm', media: '' })], play: () => assert.fail('play'), load: () => assert.fail('load') });
  const r = collect([hero, movie], [movie]); assert.equal(r.schemaVersion, 1);
  assert.equal(r.backgrounds.length, 2); assert.equal(r.backgrounds[1].pseudo, '::before');
  assert.ok(r.media.some(m => m.role === 'source' && m.selected === null));
  assert.equal(r.coverage.scannedElements, 2);
});
test('collector exposes bounded DOM and media-source scans', () => {
  const elements = Array.from({ length: 5001 }, (_, i) => node(`n${i}`, { background: 'url(/a)' }));
  const movies = Array.from({ length: 101 }, (_, i) => node(`m${i}`, { tagName: 'AUDIO', src: '', currentSrc: '', sources: Array.from({ length: 21 }, () => node('', { src: 'https://a.test/tone.wav', type: 'audio/wav', media: '' })) }));
  const r = collect(elements, movies); assert.equal(r.coverage.scannedElements, 5000); assert.equal(r.backgrounds.length, 500);
  assert.equal(r.coverage.droppedBackgrounds, 4500); assert.equal(r.coverage.scannedMedia, 100); assert.equal(r.coverage.droppedSources, 100);
});
test('collector marks oversize strings and empty currentSrc never masquerades as selected', () => {
  const movie = node('movie', { tagName: 'VIDEO', src: 'https://a.test/' + 'x'.repeat(9000), currentSrc: '', poster: '', sources: [] });
  const r = collect([], [movie]); assert.equal(r.media[0].truncated, true); assert.equal(r.media[0].selected, null);
  assert.ok(r.coverage.truncatedStrings > 0); assert.ok(r.media[0].url.length <= 8000);
});
