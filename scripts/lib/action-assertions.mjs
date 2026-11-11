import { setTimeout as delay } from 'node:timers/promises';
import { normalizeActions, assertionMatches } from './action-contract.mjs';

/** Read-only, bounded retries. Never click, scroll, modify DOM or evaluate user code. */
export async function runAssertion(page, input) {
  const action = normalizeActions([input])[0];
  if (action.type !== 'assert') throw new Error('runAssertion requires an assert action');
  const started = performance.now(), timeoutMs = action.timeoutMs ?? 5000;
  const locator = page.locator(action.selector);
  let observed = { count: 0 }, error = null;
  let first = true;
  while (first || performance.now() - started < timeoutMs) {
    first = false;
    try {
      const count = await locator.count();
      const sample = { count };
      if (count !== 1) observed = sample;
      if (count > 1) { error = 'Assertion selector is ambiguous; exactly one element is required'; break; }
      if (count === 1) {
        if (action.check === 'attribute') {
          const value = await locator.getAttribute(action.attribute, { timeout: Math.max(1, timeoutMs - (performance.now() - started)) });
          sample.value = value === null ? null : value.slice(0, 2000);
          sample.truncated = value !== null && value.length > 2000;
        } else sample.visible = await locator.isVisible();
        // Missing selectors never pass hidden checks. Recheck after reading to catch detach/duplication.
        sample.count = await locator.count();
        observed = sample; // Commit only a complete read; keep prior evidence on transport failure.
        if (assertionMatches(action, observed)) return { status: 'passed', observed, durationMs: Math.round(performance.now() - started) };
      }
    } catch (cause) {
      error = String(cause?.message ?? cause).slice(0, 2000);
      // Invalid selectors / closed pages are diagnostic failures, not silently repaired selectors.
      break;
    }
    const remaining = timeoutMs - (performance.now() - started);
    if (remaining <= 0) break;
    await delay(Math.min(50, remaining));
  }
  return { status: 'failed', observed, durationMs: Math.round(performance.now() - started),
    error: error || `Assertion ${action.check} did not match within ${timeoutMs}ms (one attached element required)` };
}
