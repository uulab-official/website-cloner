/** Runs inside the inspected page; reads only. No closure, fetch, play or load. */
export function collectMediaEvidence() {
  const elements = document.querySelectorAll('html, body, body *');
  const mediaElements = document.querySelectorAll('video,audio');
  const coverage = { totalElements: elements.length, scannedElements: Math.min(elements.length, 5000), totalMedia: mediaElements.length, scannedMedia: Math.min(mediaElements.length, 100), droppedBackgrounds: 0, droppedSources: 0, truncatedStrings: 0 };
  const backgrounds = [], media = [];
  let remainingCharacters = 500_000;
  const bounded = (input, max = 8000) => {
    const text = String(input || ''), end = Math.min(max, remainingCharacters);
    const truncated = text.length > end;
    if (truncated) coverage.truncatedStrings++;
    const value = text.slice(0, end); remainingCharacters -= value.length;
    return { value, truncated };
  };
  const selector = element => {
    if (element.id && element.id.length <= 128 && document.querySelectorAll(`#${CSS.escape(element.id)}`).length === 1) return `#${CSS.escape(element.id)}`;
    const parts = []; let node = element;
    while (node?.tagName && parts.length < 5) {
      const tag = node.tagName.toLowerCase();
      const siblings = node.parentElement ? Array.from(node.parentElement.children).filter(s => s.tagName === node.tagName) : [];
      parts.unshift(`${tag}${siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(node) + 1})` : ''}`); node = node.parentElement;
    }
    return parts.join(' > ');
  };
  for (let i = 0; i < coverage.scannedElements; i++) {
    const element = elements[i];
    for (const pseudo of [null, '::before', '::after']) {
      const style = getComputedStyle(element, pseudo);
      if (pseudo && ['none', 'normal'].includes(style.content)) continue;
      if (!style.backgroundImage || style.backgroundImage === 'none') continue;
      if (backgrounds.length >= 500) { coverage.droppedBackgrounds++; continue; }
      const value = bounded(style.backgroundImage);
      backgrounds.push({ selector: selector(element), pseudo, cssText: value.value, truncated: value.truncated });
    }
  }
  for (let i = 0; i < coverage.scannedMedia; i++) {
    const element = mediaElements[i], tag = element.tagName.toLowerCase(), hint = selector(element), current = element.currentSrc || '';
    const add = (role, source, declaredType = '', mediaQuery = '') => {
      if (!source) return;
      // Do not export embedded URL credentials. An empty value remains an
      // explicitly unusable observation rather than a rewritten reusable URL.
      let raw = source;
      try { const u = new URL(raw); if (u.username || u.password) raw = ''; } catch { /* offline validation will reject it */ }
      const url = bounded(raw), type = bounded(declaredType, 1000), query = bounded(mediaQuery, 1000);
      media.push({ selector: hint, tag, role, url: url.value, declaredType: type.value, media: query.value,
        selected: role === 'poster' ? null : role === 'current' ? true : current ? source === current : null,
        truncated: url.truncated || type.truncated || query.truncated });
    };
    if (tag === 'video') add('poster', element.poster);
    add('current', current); add('src', element.src);
    const sources = element.querySelectorAll(':scope > source');
    coverage.droppedSources += Math.max(0, sources.length - 20);
    for (let n = 0; n < Math.min(sources.length, 20); n++) add('source', sources[n].src, sources[n].type, sources[n].media);
  }
  return { schemaVersion: 1, backgrounds, media, coverage };
}
