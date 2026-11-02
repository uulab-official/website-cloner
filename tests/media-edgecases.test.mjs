import test from 'node:test';
import assert from 'node:assert/strict';
import { cssImageUrls, mediaCandidates } from '../scripts/lib/media-assets.mjs';
const base = 'https://source.test/path/page';
const bundle = cssText => ({ schemaVersion: 1, backgrounds: [{ selector: '#hero', pseudo: null, cssText, truncated: false }], media: [], coverage: { totalElements: 10, scannedElements: 10, totalMedia: 0, scannedMedia: 0, droppedBackgrounds: 0, droppedSources: 0, truncatedStrings: 0 } });
test('a resolved same-document CSS fragment is not a downloadable file candidate', () => {
  const r = mediaCandidates(bundle(`url("${base}#paint")`), base);
  assert.equal(r.candidates.length, 0); assert.ok(r.warnings.some(w => w.code === 'asset_url_unsupported'));
});
test('a fragment in a different SVG file remains an observed asset reference', () => {
  assert.equal(mediaCandidates(bundle('url("/art.svg#paint")'), base).candidates[0].source_url, 'https://source.test/art.svg#paint');
});
test('unquoted CSS backslash-newline is invalid rather than a concatenated URL', () => {
  assert.deepEqual(cssImageUrls('url(/before\\\nafter.png)'), { urls: [], complete: false });
});
test('many repeated CSS references are capped with a disclosed omission count', () => {
  const d = bundle('none'); d.backgrounds = Array.from({ length: 6 }, () => ({ selector: '#hero', pseudo: null, cssText: Array(1000).fill('url(/a)').join(','), truncated: false }));
  const r = mediaCandidates(d, base); assert.equal(r.candidates.length, 5000);
  assert.equal(r.coverage.omittedReferences, 1000); assert.ok(r.warnings.some(w => w.code === 'media_inventory_incomplete'));
});
