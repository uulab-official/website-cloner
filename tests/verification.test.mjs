import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPair, renderReport } from '../scripts/lib/verification.mjs';

const page = () => ({
  status: 'completed', viewport: { width: 390, height: 900, deviceScaleFactor: 1 },
  state: 'default', scheme: 'light', reducedMotion: 'reduce',
  environment: { browser: 'chromium', browserVersion: '134', headless: true, locale: 'en-US', timezoneId: 'UTC', isMobile: false, hasTouch: false, freshContext: true },
  screenshots: { viewport: 'viewport.png', animations: 'disabled', caret: 'hide' },
  consoleErrors: [], pageErrors: [], requestFailures: [], failedResponses: [],
});
const comparison = () => ({ status: 'compared', changedPixelRatio: 0, maxDiffRatio: null, passed: null });

test('a valid comparison without a threshold is not a visual pass', () => {
  const result = assessPair(page(), page(), comparison());
  assert.equal(result.status, 'completed');
  assert.equal(result.visualGate, 'not_requested');
  assert.equal(result.functionalParity, 'not_verified');
});
test('explicit threshold is evaluated', () => {
  assert.equal(assessPair(page(), page(), { ...comparison(), maxDiffRatio: 0.01, passed: true }).visualGate, 'passed');
  const result = assessPair(page(), page(), { status: 'threshold_exceeded', changedPixelRatio: 0.5, maxDiffRatio: 0.01, passed: false });
  assert.equal(result.status, 'failed');
  assert.equal(result.visualGate, 'failed');
});
for (const bad of [null, { status: 'failed', error: 'TLS error' }, { status: 'pending' }]) {
  test(`missing or unsuccessful source (${bad?.status}) never passes`, () => {
    const result = assessPair(bad, page(), comparison());
    assert.equal(result.status, 'failed');
    assert.equal(result.comparable, false);
  });
}
for (const key of ['browserVersion', 'locale', 'timezoneId', 'isMobile', 'hasTouch']) {
  test(`different ${key} rejects comparison`, () => {
    const target = page(); target.environment[key] = 'different';
    assert.equal(assessPair(page(), target, comparison()).comparable, false);
  });
}
test('missing environment values are not equal evidence', () => {
  const source = page(); const target = page();
  delete source.environment.browserVersion; delete target.environment.browserVersion;
  assert.equal(assessPair(source, target, comparison()).comparable, false);
});
test('different dimensions, state, scheme or screenshot policy are incompatible', () => {
  for (const mutate of [p => { p.viewport.height = 901; }, p => { p.state = 'menu'; }, p => { p.scheme = 'dark'; }, p => { p.screenshots.animations = 'allow'; }]) {
    const target = page(); mutate(target);
    assert.equal(assessPair(page(), target, comparison()).comparable, false);
  }
});
test('invalid comparison data never succeeds', () => {
  for (const value of [null, {}, { ...comparison(), changedPixelRatio: null }, { ...comparison(), changedPixelRatio: NaN }, { ...comparison(), changedPixelRatio: 2 }, { ...comparison(), maxDiffRatio: 0, changedPixelRatio: 0.5, passed: true }]) {
    assert.equal(assessPair(page(), page(), value).status, 'failed');
  }
});
test('page diagnostics remain visible without masquerading as functional verification', () => {
  const target = page(); target.pageErrors.push({ message: 'oops' });
  const result = assessPair(page(), target, comparison());
  assert.equal(result.status, 'completed');
  assert.equal(result.functionalParity, 'not_verified');
  assert.ok(result.warnings.some(value => value.includes('pageErrors')));
});
test('HTML is script-free and escapes untrusted labels and diagnostics', () => {
  const html = renderReport({ status: 'failed', sourceUrl: '<img src=x onerror=alert(1)>', targetUrl: 'https://example.test/?x="y"', state: '<script>alert(1)</script>', rows: [{ width: 390, height: 900, status: 'failed', visualGate: 'not_requested', errors: ['<script>alert(1)</script>'], warnings: [], changedPixelRatio: null }] });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('not_verified'));
  assert.ok(html.includes('Content-Security-Policy'));
});
test('report shows top-level process failures even when there are no rows', () => {
  const html = renderReport({ status: 'failed', errors: ['Process failed: <untrusted>'], rows: [] });
  assert.match(html, /Process failed: &lt;untrusted&gt;/);
});
test('a requested threshold with missing evidence is not marked unrequested or passed', () => {
  const result = assessPair(null, page(), null, 0.02);
  assert.equal(result.visualGate, 'not_evaluated');
  assert.equal(result.status, 'failed');
});
test('inconsistent comparison must never display a passed visual gate', () => {
  const result = assessPair(page(), page(), { status: 'threshold_exceeded', changedPixelRatio: 0, maxDiffRatio: 0.02, passed: false });
  assert.equal(result.status, 'failed');
  assert.equal(result.visualGate, 'not_evaluated');
});
test('comparison must use the exact threshold requested by the caller', () => {
  const result = assessPair(page(), page(), comparison(), 0.02);
  assert.equal(result.status, 'failed');
  assert.equal(result.visualGate, 'not_evaluated');
});
