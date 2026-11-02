// This function executes in the inspected page. It only reads DOM evidence;
// retrieved text and attributes are never interpreted as instructions or code.
export function collectDomEvidence(limits) {
  const round = (number) => Math.round(number * 100) / 100;
  const cleanUrl = (value) => {
    if (!value) return '';
    try {
      const url = new URL(value, document.baseURI);
      url.username = '';
      url.password = '';
      return url.href.slice(0, limits.urlLength);
    } catch { return String(value).slice(0, limits.urlLength); }
  };
  const rendered = (element) => {
    const style = getComputedStyle(element);
    const rectangle = element.getBoundingClientRect();
    return element.getClientRects().length > 0 && rectangle.width > 0 && rectangle.height > 0
      && style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' && style.opacity !== '0';
  };
  const selector = (element) => {
    if (element.id && document.querySelectorAll(`#${CSS.escape(element.id)}`).length === 1) return `#${CSS.escape(element.id)}`;
    const parts = [];
    let node = element;
    while (node?.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
      const tag = node.tagName.toLowerCase();
      const siblings = node.parentElement ? Array.from(node.parentElement.children).filter((sibling) => sibling.tagName === node.tagName) : [];
      parts.unshift(`${tag}${siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(node) + 1})` : ''}`);
      node = node.parentElement;
    }
    return parts.join(' > ');
  };
  const geometry = (element) => {
    const rectangle = element.getBoundingClientRect();
    return {
      x: round(rectangle.left + scrollX), y: round(rectangle.top + scrollY),
      width: round(rectangle.width), height: round(rectangle.height),
      viewportX: round(rectangle.left), viewportY: round(rectangle.top),
    };
  };
  const typography = (style) => ({
    fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
    fontStyle: style.fontStyle, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing,
    textAlign: style.textAlign, textTransform: style.textTransform, color: style.color,
  });
  const elementRecord = (element) => {
    const style = getComputedStyle(element);
    const rectangle = element.getBoundingClientRect();
    return {
      selector: selector(element), tag: element.tagName.toLowerCase(),
      text: (element.innerText || '').trim().slice(0, limits.elementTextLength),
      geometry: geometry(element), typography: typography(style),
      inViewport: rectangle.bottom > 0 && rectangle.right > 0 && rectangle.top < innerHeight && rectangle.left < innerWidth,
      layout: {
        display: style.display, position: style.position, gap: style.gap, padding: style.padding,
        margin: style.margin, borderRadius: style.borderRadius, backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage.slice(0, limits.urlLength),
        gridTemplateColumns: style.gridTemplateColumns, flexDirection: style.flexDirection,
        alignItems: style.alignItems, justifyContent: style.justifyContent,
      },
    };
  };
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(rendered);
  const keyElements = Array.from(document.querySelectorAll('header,nav,main,footer,section,article,aside,h1,h2,h3,h4,h5,h6,p,a,button,input,select,textarea,[role="button"],[class*="hero"],[class*="container"],[class*="grid"],[class*="card"]')).filter(rendered);
  const links = Array.from(document.querySelectorAll('a[href]')).filter(rendered);
  const images = Array.from(document.images);
  const text = document.body?.innerText || '';
  const root = document.documentElement;
  const viewportRoot = document.compatMode === 'BackCompat' && document.body ? document.body : root;
  // innerWidth includes a classic scrollbar. Keep it in the conservative PNG
  // allocation bound, but never count that reserved space as content overflow.
  const contentWidth = Math.max(root.scrollWidth, document.body?.scrollWidth || 0);
  const documentWidth = Math.max(contentWidth, innerWidth);
  const layoutViewport = {
    width: viewportRoot.clientWidth, height: viewportRoot.clientHeight,
    windowWidth: innerWidth, windowHeight: innerHeight,
    verticalGutter: Math.max(0, innerWidth - viewportRoot.clientWidth),
    horizontalGutter: Math.max(0, innerHeight - viewportRoot.clientHeight),
  };
  const contentHeight = Math.max(root.scrollHeight, document.body?.scrollHeight || 0);
  const documentHeight = Math.max(contentHeight, innerHeight);
  const overflowElements = [];
  const inspected = Array.from(document.querySelectorAll('body *')).slice(0, limits.overflowScan);
  for (const element of inspected) {
    if (!rendered(element)) continue;
    const rectangle = element.getBoundingClientRect();
    if (rectangle.left < -1 || rectangle.right > layoutViewport.width + 1) {
      overflowElements.push({ selector: selector(element), geometry: geometry(element) });
      if (overflowElements.length >= limits.overflowElements) break;
    }
  }
  return {
    finalUrl: cleanUrl(location.href), title: document.title,
    document: { width: documentWidth, height: documentHeight, language: root.lang || null },
    layoutViewport,
    userAgent: navigator.userAgent,
    scrollState: { atCapture: { x: scrollX, y: scrollY } },
    headings: headings.slice(0, limits.headings).map(elementRecord),
    keyElements: keyElements.slice(0, limits.keyElements).map(elementRecord),
    visibleText: {
      text: text.slice(0, limits.visibleTextLength), totalCharacters: text.length,
      truncated: text.length > limits.visibleTextLength,
      scope: 'Rendered DOM text including content outside the viewport; CSS-hidden text is excluded by innerText.',
    },
    links: links.slice(0, limits.links).map((element) => ({
      text: element.innerText.trim().slice(0, limits.elementTextLength), href: cleanUrl(element.href),
      target: element.target || null, rel: element.rel || null, geometry: geometry(element),
    })),
    images: images.slice(0, limits.images).map((element) => ({
      src: cleanUrl(element.src), currentSrc: cleanUrl(element.currentSrc), alt: element.alt,
      srcset: element.srcset.slice(0, limits.urlLength), sizes: element.sizes,
      loading: element.loading, complete: element.complete,
      naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight,
      rendered: rendered(element), geometry: geometry(element),
    })),
    stylesheetUrls: Array.from(document.styleSheets).map((sheet) => sheet.href).filter(Boolean).map(cleanUrl),
    inlineStylesheetCount: Array.from(document.styleSheets).filter((sheet) => !sheet.href).length,
    fonts: {
      status: document.fonts.status,
      faces: Array.from(document.fonts).slice(0, 100).map((font) => ({
        family: font.family, style: font.style, weight: font.weight, status: font.status,
      })),
    },
    overflow: {
      horizontal: contentWidth > layoutViewport.width + 1,
      vertical: contentHeight > layoutViewport.height + 1,
      viewportWidth: layoutViewport.width, documentWidth: contentWidth, documentHeight,
      horizontalPixels: Math.max(0, contentWidth - layoutViewport.width),
      elements: overflowElements, scannedElements: inspected.length,
      note: 'Overflow element bounds are diagnostic and may include intentional off-canvas content.',
    },
    totals: { headings: headings.length, keyElements: keyElements.length, links: links.length, images: images.length },
    limits,
  };
}
