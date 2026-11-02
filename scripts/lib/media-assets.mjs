import { httpUrl } from './cli.mjs';

/** Extract URL tokens from computed background-image data; never evaluate CSS.
 * Handles url() and direct image-set strings. Not a general CSS validator. */
export function cssImageUrls(value) {
  if (typeof value !== 'string' || value.length > 8000) throw new Error('Invalid background CSS value');
  let i = 0;
  const urls = [], stack = [];
  const invalid = () => { throw new Error('Incomplete CSS token'); };
  const space = c => c !== undefined && /\s/.test(c);
  const skipSpace = () => { while (space(value[i])) i++; };
  const escaped = () => {
    i++;
    if (i >= value.length) invalid();
    if (value[i] === '\n' || value[i] === '\r' || value[i] === '\f') {
      if (value[i++] === '\r' && value[i] === '\n') i++;
      return '';
    }
    const hex = value.slice(i).match(/^[0-9a-f]{1,6}/i)?.[0];
    if (!hex) return value[i++];
    i += hex.length;
    if (space(value[i])) { if (value[i++] === '\r' && value[i] === '\n') i++; }
    const point = parseInt(hex, 16);
    return String.fromCodePoint(!point || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff) ? 0xfffd : point);
  };
  const quoted = () => {
    const quote = value[i++]; let result = '';
    while (i < value.length && value[i] !== quote) {
      if (/[\n\r\f]/.test(value[i])) invalid();
      result += value[i] === '\\' ? escaped() : value[i++];
    }
    if (value[i++] !== quote) invalid();
    return result;
  };
  const urlArgument = () => {
    skipSpace(); let result = '';
    if (value[i] === '"' || value[i] === "'") result = quoted();
    else {
      while (i < value.length && value[i] !== ')' && !space(value[i])) {
        if (/[('"\u0000-\u001f\u007f]/.test(value[i])) invalid();
        result += value[i] === '\\' ? escaped() : value[i++];
      }
    }
    skipSpace(); if (value[i++] !== ')') invalid(); return result;
  };
  try {
    while (i < value.length) {
      skipSpace(); if (i >= value.length) break;
      if (value.startsWith('/*', i)) {
        const end = value.indexOf('*/', i + 2); if (end < 0) invalid(); i = end + 2; continue;
      }
      const frame = stack.at(-1);
      if (value[i] === '"' || value[i] === "'") {
        const result = quoted(); if (frame?.imageStart) urls.push(result);
        if (frame) frame.imageStart = false;
        continue;
      }
      const identifier = value.slice(i).match(/^[a-z_-][a-z0-9_-]*/i)?.[0];
      if (identifier) {
        i += identifier.length; skipSpace();
        if (frame) frame.imageStart = false;
        if (value[i] === '(') {
          i++; const name = identifier.toLowerCase();
          if (name === 'url') urls.push(urlArgument());
          else stack.push({ name, imageStart: /^(?:-webkit-)?image-set$/.test(name) });
        }
        continue;
      }
      const char = value[i++];
      if (char === ')') { if (!stack.length) invalid(); stack.pop(); }
      else if (char === '(' || char === '\\') invalid();
      else if (char === ',' && frame) frame.imageStart = /^(?:-webkit-)?image-set$/.test(frame.name);
      else if (frame) frame.imageStart = false;
    }
    if (stack.length) invalid();
    return { urls, complete: true };
  } catch { return { urls: [], complete: false }; }
}

const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
function check(condition, field) { if (!condition) throw new Error(`Invalid media asset ${field}`); }
function text(value, field, max = 8000) { check(typeof value === 'string' && value.length <= max, field); return value; }
function count(value, field, max = 1_000_000_000) { check(Number.isSafeInteger(value) && value >= 0 && value <= max, field); return value; }
function assetUrl(value, base) {
  if (!value || value.startsWith('#') || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try { return httpUrl(new URL(value, base).href); } catch { return null; }
}

/** Validate optional capture extension and return unapproved asset references. */
export function mediaCandidates(data, baseUrl) {
  const warnings = [], candidates = [];
  const warn = (code, message) => warnings.push({ code, message });
  if (data === undefined) return { candidates, coverage: { status: 'not_recorded' }, warnings: [{ code: 'media_not_recorded', message: 'This capture predates extended CSS/media observations. Absence of records is not absence of assets.' }] };
  check(object(data) && data.schemaVersion === 1, 'schema');
  check(Array.isArray(data.backgrounds) && data.backgrounds.length <= 500, 'backgrounds');
  check(Array.isArray(data.media) && data.media.length <= 2400, 'media list');
  check(object(data.coverage), 'coverage');
  const c = {};
  for (const key of ['totalElements', 'scannedElements', 'totalMedia', 'scannedMedia', 'droppedBackgrounds', 'droppedSources', 'truncatedStrings']) c[key] = count(data.coverage[key], `coverage.${key}`);
  check(c.scannedElements <= Math.min(c.totalElements, 5000) && c.scannedMedia <= Math.min(c.totalMedia, 100), 'coverage scan limits');
  if (c.scannedElements < c.totalElements || c.scannedMedia < c.totalMedia || c.droppedBackgrounds || c.droppedSources || c.truncatedStrings) {
    warn('media_inventory_incomplete', 'The bounded CSS/media scan omitted or truncated records; inspect asset coverage counters.');
  }
  const add = (value, kind, observation) => {
    const source = assetUrl(value, baseUrl);
    if (!source) { warn('asset_url_unsupported', 'An empty, local-fragment, credential-bearing, control-character or non-HTTP(S) asset reference was excluded.'); return; }
    candidates.push({ source_url: source, kind, observation });
  };
  for (const b of data.backgrounds) {
    check(object(b), 'background entry'); text(b.selector, 'background selector'); text(b.cssText, 'background CSS');
    check([null, '::before', '::after'].includes(b.pseudo), 'background pseudo'); check(typeof b.truncated === 'boolean', 'background truncated');
    if (b.truncated) { warn('media_inventory_incomplete', 'A truncated CSS background value was not parsed.'); continue; }
    const parsed = cssImageUrls(b.cssText);
    if (!parsed.complete) { warn('css_background_unparsed', 'An incomplete or unsupported CSS background expression was not parsed.'); continue; }
    for (const source of parsed.urls) add(source, 'image', { role: 'css-background', selector: b.selector, pseudo: b.pseudo, selected: null, playbackVerified: false });
  }
  for (const m of data.media) {
    check(object(m), 'media entry'); text(m.selector, 'media selector'); text(m.url, 'media URL');
    text(m.declaredType, 'media declaredType', 1000); text(m.media, 'media query', 1000);
    check(['video', 'audio'].includes(m.tag), 'media tag'); check(['poster', 'current', 'src', 'source'].includes(m.role), 'media role');
    check([null, true, false].includes(m.selected) && (m.role !== 'current' || m.selected === true), 'media selected');
    check(m.role !== 'poster' || (m.tag === 'video' && m.selected === null), 'media poster'); check(typeof m.truncated === 'boolean', 'media truncated');
    if (m.truncated) { warn('media_inventory_incomplete', 'A truncated media URL was excluded.'); continue; }
    add(m.url, m.role === 'poster' ? 'image' : m.tag, { role: m.role === 'poster' ? 'video-poster' : m.role, tag: m.tag, selector: m.selector, selected: m.selected, declaredType: m.declaredType || null, media: m.media || null, playbackVerified: false });
  }
  return { candidates, coverage: { status: 'recorded', ...c }, warnings };
}

/** Merge by URL without confusing CSS box size with intrinsic image dimensions. */
export function mergeMediaCandidates(assets, candidates, view) {
  for (const entry of candidates) {
    if (!assets.has(entry.source_url)) assets.set(entry.source_url, {
      source_url: entry.source_url, local_path: null, kind: entry.kind, content_type: null, dimensions: null,
      usage: 'Observed CSS/HTML asset reference; selection does not prove loading or playback', rights: 'unknown', status: 'planned', observations: [],
    });
    const asset = assets.get(entry.source_url);
    if (asset.kind !== entry.kind) asset.kind = 'other';
    asset.observations.push({ view, ...entry.observation });
  }
}
