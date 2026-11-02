/** Lossless comparison of decoded RGBA8 channels, independent of pixelmatch. */
function pixelCount(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > 100_000_000) {
    throw new Error('Exact RGBA dimensions must contain 1..100 million pixels');
  }
  return width * height;
}
function bytes(value, size, label) {
  if (!(value instanceof Uint8Array || value instanceof Uint8ClampedArray) || value.length !== size) {
    throw new Error(`${label} must be a correctly sized RGBA byte array`);
  }
}
function overlaps(a, b) {
  return a.buffer === b.buffer && a.byteOffset < b.byteOffset + b.byteLength && b.byteOffset < a.byteOffset + a.byteLength;
}

/** Optional mask: white means any RGBA channel differs, black means equal; opaque alpha. */
export function measureExactPixels(source, target, width, height, mask) {
  const totalPixels = pixelCount(width, height);
  bytes(source, totalPixels * 4, 'Source'); bytes(target, totalPixels * 4, 'Target');
  if (mask !== undefined) {
    bytes(mask, totalPixels * 4, 'Output mask');
    if (overlaps(mask, source) || overlaps(mask, target)) throw new Error('Output mask must not overlap input RGBA data');
  }
  let changedPixels = 0; let deltaSum = 0; let maxChannelDelta = 0;
  let minX = width; let minY = height; let maxX = -1; let maxY = -1;
  for (let index = 0; index < source.length; index += 4) {
    let changed = false;
    for (let channel = 0; channel < 4; channel++) {
      const delta = Math.abs(source[index + channel] - target[index + channel]);
      deltaSum += delta; if (delta > maxChannelDelta) maxChannelDelta = delta;
      changed ||= delta !== 0;
    }
    if (changed) {
      changedPixels++;
      const pixel = index / 4; const x = pixel % width; const y = Math.floor(pixel / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (mask !== undefined) {
      const value = changed ? 255 : 0;
      mask[index] = value; mask[index + 1] = value; mask[index + 2] = value; mask[index + 3] = 255;
    }
  }
  return { schemaVersion: 1, method: 'decoded-rgba8', width, height, totalPixels, changedPixels,
    changedPixelRatio: changedPixels / totalPixels, identical: changedPixels === 0,
    maxChannelDelta, meanAbsoluteChannelDelta: deltaSum / (totalPixels * 4),
    bounds: changedPixels ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null };
}

/** Validate optional report extensions before trusting or displaying equality. */
export function validateExactPixels(value, width, height) {
  const totalPixels = pixelCount(width, height);
  const invalid = () => { throw new Error('Invalid or inconsistent exact RGBA metrics'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const { changedPixels, changedPixelRatio, identical, maxChannelDelta, meanAbsoluteChannelDelta, bounds } = value;
  if (value.schemaVersion !== 1 || value.method !== 'decoded-rgba8' || value.width !== width || value.height !== height
    || value.totalPixels !== totalPixels || !Number.isSafeInteger(changedPixels) || changedPixels < 0 || changedPixels > totalPixels
    || changedPixelRatio !== changedPixels / totalPixels || identical !== (changedPixels === 0)
    || !Number.isInteger(maxChannelDelta) || maxChannelDelta < 0 || maxChannelDelta > 255
    || typeof meanAbsoluteChannelDelta !== 'number' || !Number.isFinite(meanAbsoluteChannelDelta)
    || meanAbsoluteChannelDelta < 0 || meanAbsoluteChannelDelta > maxChannelDelta) invalid();
  if (changedPixels === 0) {
    if (bounds !== null || maxChannelDelta !== 0 || meanAbsoluteChannelDelta !== 0) invalid();
  } else {
    if (maxChannelDelta < 1 || meanAbsoluteChannelDelta < changedPixels / (totalPixels * 4)
      || meanAbsoluteChannelDelta > changedPixels * maxChannelDelta / totalPixels
      || !bounds || typeof bounds !== 'object' || Array.isArray(bounds)
      || !['x','y','width','height'].every(key => Number.isSafeInteger(bounds[key]))
      || bounds.x < 0 || bounds.y < 0 || bounds.width < 1 || bounds.height < 1
      || bounds.x + bounds.width > width || bounds.y + bounds.height > height
      || bounds.width * bounds.height < changedPixels) invalid();
  }
  // Return only validated fields, never arbitrary evidence text or URLs.
  return { schemaVersion: 1, method: 'decoded-rgba8', width, height, totalPixels, changedPixels,
    changedPixelRatio, identical, maxChannelDelta, meanAbsoluteChannelDelta,
    bounds: bounds === null ? null : { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } };
}

export const zeroDifferenceWarning = 'Tolerance-filtered difference is zero, but decoded RGBA pixels differ. Zero does not mean identical; review the exact pixel mask.';
export function formatPixelRatio(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return 'not measured';
  if (value > 0 && value < 0.00000001) return '<0.000001% (nonzero)';
  return `${(value * 100).toFixed(6)}%`;
}
export function exactPixelSummary(value, width, height) {
  if (value === null || value === undefined) return 'Exact RGBA: not measured; decoded RGBA equality: not measured.';
  let exact;
  try { exact = validateExactPixels(value, width, height); }
  catch { return 'Exact RGBA: invalid evidence; decoded RGBA equality: not measured.'; }
  return `Exact RGBA: ${formatPixelRatio(exact.changedPixelRatio)} (${exact.changedPixels}/${exact.totalPixels}); decoded RGBA equality: ${exact.identical ? 'identical' : 'different'}.`;
}
