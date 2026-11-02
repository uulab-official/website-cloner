import test from 'node:test';
import assert from 'node:assert/strict';
const mod = await import('../scripts/lib/media-assets.mjs').catch(e => {
  if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e;
});
const css = value => { assert.equal(typeof mod.cssImageUrls, 'function', 'CSS asset parser is missing'); return mod.cssImageUrls(value); };
const read = value => { assert.equal(typeof mod.mediaCandidates, 'function', 'Extended asset normalizer is missing'); return mod.mediaCandidates(value, 'https://source.test/path/page'); };
const coverage = () => ({ totalElements: 10, scannedElements: 10, totalMedia: 1, scannedMedia: 1, droppedBackgrounds: 0, droppedSources: 0, truncatedStrings: 0 });
const bundle = () => ({ schemaVersion: 1, backgrounds: [], media: [], coverage: coverage() });
const bg = cssText => ({ selector: '#hero', pseudo: null, cssText, truncated: false });
const media = (role, url, tag = 'video') => ({ selector: '#media', tag, role, url, selected: role === 'current' ? true : null, truncated: false, declaredType: '', media: '' });

for (const [label, input, expected] of [
  ['gradient only', 'linear-gradient(red, blue)', []],
  ['none', 'none', []],
  ['layered backgrounds', 'linear-gradient(red,blue), url("https://a.test/a,b.png"), url(/b.png)', ['https://a.test/a,b.png', '/b.png']],
  ['parenthesis in string', 'url("/image(2).png")', ['/image(2).png']],
  ['CSS quoted escape', String.raw`url("/a\22 b.png")`, ['/a"b.png']],
  ['CSS escaped parenthesis', String.raw`url(/image\(2\).png)`, ['/image(2).png']],
  ['image-set strings and URL', 'image-set("/a.png" 1x, url("/b.png") 2x)', ['/a.png', '/b.png']],
  ['image-set type string not a resource', 'image-set("/a.avif" type("image/avif") 1x, "/b.webp" 2x)', ['/a.avif', '/b.webp']],
  ['ignore URL-looking strings', 'linear-gradient("url(/fake.png)", red),url(/real.png)', ['/real.png']],
  ['comments', '/* url(/fake) */ url("/real.png")', ['/real.png']],
  ['same URL in two layers retained', 'url(/a),url(/a)', ['/a', '/a']],
]) test(`CSS extraction: ${label}`, () => { const r = css(input); assert.equal(r.complete, true); assert.deepEqual(r.urls, expected); });
for (const value of ['url("/truncated', 'url(/a', 'url(/a b)', 'url("/a") )', 'url("/a\n.png")', '/* broken', 'image-set("/a" 1x']) {
  test(`malformed CSS is not partially trusted: ${JSON.stringify(value)}`, () => { const r = css(value); assert.equal(r.complete, false); assert.deepEqual(r.urls, []); });
}
test('legacy capture remains readable with explicit unrecorded media coverage', () => {
  const r = read(undefined); assert.equal(r.coverage.status, 'not_recorded'); assert.deepEqual(r.candidates, []);
  assert.ok(r.warnings.some(w => w.code === 'media_not_recorded'));
});
test('extended record retains background, pseudo-element, poster and media provenance', () => {
  const data = bundle(); data.backgrounds = [bg('url(/hero.webp)'), { ...bg('url(/badge.svg)'), pseudo: '::before' }];
  data.media = [media('poster', '/poster.webp'), media('current', '/movie.mp4'), media('source', '/alternate.webm'), media('src', '/audio.wav', 'audio')];
  const r = read(data); assert.equal(r.candidates.length, 6);
  assert.equal(r.candidates[0].source_url, 'https://source.test/hero.webp');
  assert.equal(r.candidates[1].observation.pseudo, '::before');
  assert.equal(r.candidates.find(a => a.kind === 'video' && a.observation.role === 'current').observation.selected, true);
  assert.equal(r.candidates.find(a => a.observation.role === 'source').observation.selected, null);
  assert.equal(r.candidates.find(a => a.kind === 'audio').observation.playbackVerified, false);
});
for (const source of ['data:image/svg+xml,abc', 'blob:https://source.test/abc', 'javascript:alert(1)', 'file:///tmp/a', 'https://user:pass@source.test/a', '#local', '/bad\nurl']) {
  test(`unsupported asset URL is reported, never a reusable candidate: ${JSON.stringify(source)}`, () => {
    const data = bundle(); data.media = [media('poster', source)]; const r = read(data);
    assert.equal(r.candidates.length, 0); assert.ok(r.warnings.some(w => w.code === 'asset_url_unsupported'));
  });
}
test('truncated CSS and media URLs never become plausible partial URLs', () => {
  const data = bundle(); data.backgrounds = [{ ...bg('url(/partial)'), truncated: true }]; data.media = [{ ...media('src', '/partial'), truncated: true }];
  data.coverage.truncatedStrings = 2;
  const r = read(data); assert.deepEqual(r.candidates, []); assert.ok(r.warnings.some(w => w.code === 'media_inventory_incomplete'));
});
test('bounded scans and dropped records are disclosed', () => {
  const data = bundle(); data.coverage = { ...coverage(), totalElements: 6000, scannedElements: 5000, totalMedia: 120, scannedMedia: 100, droppedBackgrounds: 2, droppedSources: 3 };
  assert.ok(read(data).warnings.some(w => w.code === 'media_inventory_incomplete'));
});
for (const [label, mutate] of [
  ['schema', d => { d.schemaVersion = 2; }],
  ['background list', d => { d.backgrounds = null; }],
  ['background count', d => { d.backgrounds = Array(501).fill(bg('none')); }],
  ['media count', d => { d.media = Array(2401).fill(media('src', '/a')); }],
  ['scan mismatch', d => { d.coverage.scannedElements = 11; }],
  ['negative dropped count', d => { d.coverage.droppedSources = -1; }],
  ['unbounded scan', d => { d.coverage.totalElements = 9000; d.coverage.scannedElements = 9000; }],
  ['unknown role', d => { d.media = [media('execute', '/a')]; }],
  ['unknown media kind', d => { d.media = [media('src', '/a', 'iframe')]; }],
  ['contradictory currentSrc', d => { d.media = [{ ...media('current', '/a'), selected: false }]; }],
  ['audio poster', d => { d.media = [media('poster', '/a', 'audio')]; }],
  ['unknown pseudo', d => { d.backgrounds = [{ ...bg('none'), pseudo: '::unknown' }]; }],
  ['oversized CSS', d => { d.backgrounds = [bg('x'.repeat(8001))]; }],
]) test(`reject inconsistent extension: ${label}`, () => { const d = bundle(); mutate(d); assert.throws(() => read(d), /asset|media|background|coverage|schema|CSS|scan|role|pseudo/i); });
test('null extension is malformed, not legacy', () => assert.throws(() => read(null), /media|asset/i));
test('CSS escaped spaces remain valid filenames rather than being silently lost', () => {
  const d = bundle(); d.backgrounds = [bg(String.raw`url(/hello\ world.png)`)];
  assert.equal(read(d).candidates[0]?.source_url, 'https://source.test/hello%20world.png');
});
test('merge preserves known image size across CSS and poster uses and keeps distinct provenance', () => {
  assert.equal(typeof mod.mergeMediaCandidates, 'function');
  const url = 'https://source.test/shared.png';
  const assets = new Map([[url, { source_url: url, kind: 'image', dimensions: { width: 80, height: 40 }, rights: 'unknown', observations: [{ role: 'img', view: '320x320' }] }]]);
  const d = bundle(); d.backgrounds = [bg('url(/shared.png)')]; d.media = [media('poster', '/shared.png')];
  mod.mergeMediaCandidates(assets, read(d).candidates, '320x320');
  assert.equal(assets.size, 1); assert.deepEqual(assets.get(url).dimensions, { width: 80, height: 40 });
  assert.deepEqual(assets.get(url).observations.map(o => o.role), ['img', 'css-background', 'video-poster']);
});
test('a URL observed in incompatible media roles is not assigned a guessed MIME type', () => {
  const d = bundle(); d.media = [media('poster', '/ambiguous'), media('src', '/ambiguous')];
  const assets = new Map(); mod.mergeMediaCandidates(assets, read(d).candidates, '320x320');
  const a = [...assets.values()][0]; assert.equal(a.kind, 'other'); assert.equal(a.content_type, null); assert.equal(a.rights, 'unknown');
});
