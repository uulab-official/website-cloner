import { assertActionResults } from './action-contract.mjs';
import { validateExactPixels, formatPixelRatio, exactPixelSummary, zeroDifferenceWarning } from './exact-pixels.mjs';

import { supportedBrowsers } from './browser-check.mjs';

/** Assess captured evidence, not the semantic quality of a rebuilt website. */
export function assessPair(source, target, comparison, requestedMaxDiffRatio = comparison?.maxDiffRatio ?? null, requestedBrowser) {
  const errors = [];
  const warnings = [];
  const fields = [
    ['viewport', 'width'], ['viewport', 'height'], ['viewport', 'deviceScaleFactor'],
    ['state'], ['scheme'], ['reducedMotion'],
    ...['browser', 'browserVersion', 'headless', 'locale', 'timezoneId', 'isMobile', 'hasTouch', 'freshContext'].map(key => ['environment', key]),
    ['screenshots', 'animations'], ['screenshots', 'caret'],
  ];
  for (const [label, record] of [['source', source], ['target', target]]) {
    if (record?.status !== 'completed') errors.push(`${label}: capture not completed${record?.error ? `: ${record.error}` : ''}`);
    if (!supportedBrowsers.includes(record?.environment?.browser)) errors.push(`${label}: unsupported or missing browser engine`);
    if (typeof record?.environment?.browserVersion !== 'string' || !record.environment.browserVersion.trim()) errors.push(`${label}: missing browser version`);
    if (requestedBrowser !== undefined && (!supportedBrowsers.includes(requestedBrowser) || record?.environment?.browser !== requestedBrowser)) errors.push(`${label}: capture does not match requested browser`);
    if (!record?.screenshots?.viewport) errors.push(`${label}: viewport screenshot missing`);
    if (record && Object.hasOwn(record, 'layoutViewport')) {
      const v = record.layoutViewport;
      if (!v || !['width', 'height', 'windowWidth', 'windowHeight'].every(key => Number.isInteger(v[key]) && v[key] > 0)
        || !['verticalGutter', 'horizontalGutter'].every(key => Number.isInteger(v[key]) && v[key] >= 0)
        || v.windowWidth !== record.viewport?.width || v.windowHeight !== record.viewport?.height
        || v.width + v.verticalGutter !== v.windowWidth || v.height + v.horizontalGutter !== v.windowHeight) {
        errors.push(`${label}: invalid or inconsistent layout viewport evidence`);
      }
    }
    try { assertActionResults(record?.actions); } catch (error) { errors.push(`${label}: ${error.message}`); }
    if (record?.overflow?.horizontal === true) warnings.push(`${label}: horizontal content overflow=${record.overflow.horizontalPixels}px; inspect page.json`);
    for (const name of ['consoleErrors', 'pageErrors', 'requestFailures', 'failedResponses']) {
      if (record?.[name]?.length) warnings.push(`${label}: ${name}=${record[name].length}; inspect page.json`);
    }
  }
  for (const keys of fields) {
    const a = keys.reduce((value, key) => value?.[key], source);
    const b = keys.reduce((value, key) => value?.[key], target);
    if (a === undefined || a === null || b === undefined || b === null || a !== b) {
      errors.push(`Incompatible or missing capture condition: ${keys.join('.')}`);
    }
  }
  const sourceLayout = source?.layoutViewport, targetLayout = target?.layoutViewport;
  if (sourceLayout && targetLayout) {
    if (sourceLayout.width !== targetLayout.width || sourceLayout.height !== targetLayout.height) {
      warnings.push(`Rendered layout viewport differs: source ${sourceLayout.width} x ${sourceLayout.height}; target ${targetLayout.width} x ${targetLayout.height}. Scrollbar space may affect wrapping; pixel comparison is retained.`);
    }
  } else if (sourceLayout || targetLayout) {
    warnings.push('Rendered layout viewport not recorded on both sides; layout parity is unverified.');
  }
  const comparable = errors.length === 0;
  let visualGate = requestedMaxDiffRatio === null ? 'not_requested' : 'not_evaluated';
  let changedPixelRatio = null;
  let exactPixels = null;
  if (comparable) {
    const validRatio = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
    if (!comparison || !['compared', 'threshold_exceeded'].includes(comparison.status)
      || comparison.maxDiffRatio !== requestedMaxDiffRatio
      || !validRatio(comparison.changedPixelRatio)
      || !(comparison.maxDiffRatio === null || validRatio(comparison.maxDiffRatio))) {
      errors.push(`Comparison unavailable or invalid${comparison?.error ? `: ${comparison.error}` : ''}`);
    } else {
      changedPixelRatio = comparison.changedPixelRatio;
      const expected = comparison.maxDiffRatio === null ? null : changedPixelRatio <= comparison.maxDiffRatio;
      const expectedStatus = expected === false ? 'threshold_exceeded' : 'compared';
      if (comparison.passed !== expected || comparison.status !== expectedStatus) errors.push('Inconsistent comparison threshold result');
      else if (expected !== null) visualGate = expected ? 'passed' : 'failed';
      if (expected === false) errors.push('Changed-pixel ratio exceeds the explicitly requested threshold');
      if (Object.hasOwn(comparison, 'exactPixels')) {
        try {
          exactPixels = validateExactPixels(comparison.exactPixels, source.viewport.width, source.viewport.height);
          if (changedPixelRatio === 0 && !exactPixels.identical) warnings.push(zeroDifferenceWarning);
        } catch (error) {
          errors.push(error.message);
          visualGate = requestedMaxDiffRatio === null ? 'not_requested' : 'not_evaluated';
        }
      }
    }
  }
  return { browser: source?.environment?.browser ?? null, browserVersion: source?.environment?.browserVersion ?? null, comparable, status: errors.length ? 'failed' : 'completed', visualGate, changedPixelRatio, exactPixels, functionalParity: 'not_verified', errors, warnings };
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** No scripts, remote assets, source HTML, or evidence-supplied hrefs. */
export function renderReport(report) {
  const runErrors = (report.errors || []).map(error => `<li>${escapeHtml(error)}</li>`).join('');
  const rows = report.rows.map(row => {
    const safeDimensions = Number.isInteger(row.width) && row.width > 0 && row.width <= 8192
      && Number.isInteger(row.height) && row.height > 0 && row.height <= 8192;
    const folder = safeDimensions ? `${row.width}x${row.height}` : null;
    const images = folder ? [
      row.sourceCaptured ? `<figure><figcaption>Source URL capture</figcaption><a href="source/${folder}/full-page.png"><img alt="Source viewport" src="source/${folder}/viewport.png" loading="lazy"></a></figure>` : '',
      row.targetCaptured ? `<figure><figcaption>Implementation</figcaption><a href="target/${folder}/full-page.png"><img alt="Implementation viewport" src="target/${folder}/viewport.png" loading="lazy"></a></figure>` : '',
    ].join('') : '';
    const links = folder && row.hasComparison ? `<p><a href="comparisons/${folder}/diff.png">Tolerance-filtered diff</a> · ${row.exactPixels ? `<a href="comparisons/${folder}/exact-diff.png">Exact RGBA mask</a> · ` : ''} <a href="comparisons/${folder}/side-by-side.png">Side by side</a> · <a href="comparisons/${folder}/report.json">Comparison JSON</a></p>` : '';
    const notes = [...(row.errors || []), ...(row.warnings || [])].map(item => `<li>${escapeHtml(item)}</li>`).join('');
    return `<section><h2>${escapeHtml(row.width)} × ${escapeHtml(row.height)}</h2><p>Observed engine: ${escapeHtml(row.browser ?? 'not recorded')} · Version: ${escapeHtml(row.browserVersion ?? 'not recorded')}</p><p>Execution: <strong>${escapeHtml(row.status)}</strong> · Visual threshold: ${escapeHtml(row.visualGate)}</p><p>Tolerance-filtered difference: ${escapeHtml(formatPixelRatio(row.changedPixelRatio))} (pixelmatch 0.1; anti-aliasing excluded; not a fidelity score)</p><p>${escapeHtml(exactPixelSummary(row.exactPixels, row.width, row.height))}</p>${notes ? `<ul>${notes}</ul>` : ''}<div class="pair">${images}</div>${links}</section>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Website Cloner — paired verification</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:1280px;margin:auto;padding:32px}h1{line-height:1.2}section{border-top:1px solid;padding:24px 0}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}figure{margin:0}img{display:block;width:100%;height:auto}p,li{overflow-wrap:anywhere}figcaption{font-weight:bold;margin-bottom:8px}@media(max-width:600px){body{padding:16px}.pair{grid-template-columns:1fr}}</style><h1>Paired verification</h1>${runErrors ? `<ul>${runErrors}</ul>` : ''}<p>Execution: <strong>${escapeHtml(report.status)}</strong> · State: ${escapeHtml(report.state)}</p><p>Browser: ${escapeHtml(report.browser ?? 'not recorded')}</p><p>Source: ${escapeHtml(report.sourceUrl)}<br>Implementation: ${escapeHtml(report.targetUrl)}</p><p>Functional parity: <strong>not_verified</strong>. Static reduced-motion screenshots do not verify motion, physical devices, backend behavior, or interaction correctness. Diagnostics are warnings, not a functional test pass.</p><p>Tolerant zero does not mean identical. Exact RGBA compares decoded channels including alpha and invisible RGB, not PNG file bytes. In the exact mask, white pixels differ and black pixels are equal. Neither metric verifies function or visual quality.</p><p><a href="verification.json">Complete JSON evidence</a></p>${rows}</html>\n`;
}
