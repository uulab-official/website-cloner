export async function scrollPosition(page) {
  return page.evaluate(() => ({
    x: scrollX, y: scrollY, documentWidth: document.documentElement.scrollWidth,
    documentHeight: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
  }));
}

export async function settleResources(page, { includeLazy = false } = {}) {
  return page.evaluate(async ({ includeLazy }) => {
    const bounded = async (promise, milliseconds) => {
      let timer;
      try {
        return await Promise.race([
          promise.then(() => 'ready', () => 'failed'),
          new Promise((resolve) => { timer = setTimeout(() => resolve('timed_out'), milliseconds); }),
        ]);
      } finally { clearTimeout(timer); }
    };
    const fonts = await bounded(document.fonts.ready, 8000);
    const candidates = Array.from(document.images).filter((image) => {
      const box = image.getBoundingClientRect();
      return includeLazy || image.complete || image.loading !== 'lazy' || (box.bottom > 0 && box.top < innerHeight);
    });
    const images = await bounded(Promise.all(candidates.map(async (image) => {
      if (image.complete) return;
      try { await image.decode(); } catch { /* Broken images remain evidence. */ }
    })), 8000);
    const allImages = Array.from(document.images);
    return {
      fonts, fontStatus: document.fonts.status, images,
      imageCount: allImages.length, pendingImages: allImages.filter((image) => !image.complete).length,
      brokenImages: allImages.filter((image) => image.complete && image.naturalWidth === 0 && Boolean(image.currentSrc || image.src)).length,
      perResourceTimeoutMs: 8000, includesOffscreenLazyImages: includeLazy,
    };
  }, { includeLazy });
}

export async function normalizeAnimations(page) {
  return page.evaluate(() => {
    const result = {
      finished: 0, canceled: 0, pausedAtEnd: 0, failed: 0,
      scope: 'Current CSS and Web Animations only; finite animations finish (zero-rate animations pause at their endpoint), and infinite animations cancel to the underlying style. Script-driven and video motion are not verified.',
    };
    for (const animation of document.getAnimations()) {
      try {
        const endTime = animation.effect?.getComputedTiming().endTime;
        if (Number.isFinite(endTime)) {
          if (animation.playbackRate === 0) {
            animation.currentTime = endTime;
            animation.pause();
            result.pausedAtEnd++;
          } else {
            animation.finish();
            result.finished++;
          }
        } else {
          animation.cancel();
          result.canceled++;
        }
      } catch { result.failed++; }
    }
    return result;
  });
}

export async function revealLazyMedia(page) {
  const limits = { maxSteps: 30, maxScrollY: 40_000, maxDurationMs: 10_000, stepDelayMs: 120 };
  const start = Date.now();
  const before = await scrollPosition(page);
  let steps = 0;
  let stableBottom = 0;
  let lastHeight = 0;
  let stoppedBy = 'step_limit';
  while (steps < limits.maxSteps) {
    if (Date.now() - start >= limits.maxDurationMs) { stoppedBy = 'time_limit'; break; }
    const position = await page.evaluate(() => ({
      y: scrollY, height: innerHeight,
      total: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
    }));
    const atBottom = position.y + position.height >= position.total - 2;
    stableBottom = atBottom && position.total === lastHeight ? stableBottom + 1 : 0;
    if (stableBottom >= 2) { stoppedBy = 'bottom'; break; }
    if (position.y >= limits.maxScrollY) { stoppedBy = 'distance_limit'; break; }
    lastHeight = position.total;
    const target = Math.min(limits.maxScrollY, Math.max(0, position.total - position.height), position.y + Math.max(200, Math.floor(position.height * 0.85)));
    await page.evaluate((y) => window.scrollTo({ left: 0, top: y, behavior: 'instant' }), target);
    await page.waitForTimeout(limits.stepDelayMs);
    steps++;
  }
  const after = await scrollPosition(page);
  await page.evaluate(() => window.scrollTo({ left: 0, top: 0, behavior: 'instant' }));
  return {
    before, after, steps, stoppedBy, reachedBottom: stoppedBy === 'bottom',
    durationMs: Date.now() - start, limits,
    note: 'Bounded scrolling cannot guarantee discovery of every lazy asset or infinite-scroll item.',
  };
}
