import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSuite, assessSuiteCase, summarizeSuite, renderSuiteReport, verifyArguments } from '../scripts/lib/suite.mjs';

const manifest = () => ({ schemaVersion: 1, name: 'Example routes', cases: [
  { id: 'home', source: 'https://source.example/a?q=1#faq', target: 'http://localhost:4173/a?q=1#faq' },
] });
const spec = () => normalizeSuite(manifest()).cases[0];
const command = { exitCode: 0, signal: null, error: null };
function evidence(item = spec()) {
  return { schemaVersion: 1, tool: 'website-cloner/verify', status: 'completed',
    sourceUrl: item.source, targetUrl: item.target, widths: item.widths, height: item.height,
    scheme: item.scheme, state: item.state, maxDiffRatio: item.maxDiffRatio,
    errors: [], rows: item.widths.map(width => ({ width, height: item.height, status: 'completed',
      comparable: true, sourceCaptured: true, targetCaptured: true, hasComparison: true,
      changedPixelRatio: 0, visualGate: item.maxDiffRatio === null ? 'not_requested' : 'passed', errors: [], warnings: [] })),
  };
}

test('normalizes defaults without mutating the manifest', () => {
  const input = manifest(); const before = structuredClone(input); const item = normalizeSuite(input).cases[0];
  assert.deepEqual(item.widths, [1440, 768, 390]); assert.equal(item.height, 900);
  assert.equal(item.state, 'home'); assert.equal(item.scheme, 'light'); assert.equal(item.maxDiffRatio, null);
  assert.deepEqual(item.sourceActions, []); assert.equal(item.keepScroll, false); assert.deepEqual(input, before);
});
test('per-case settings override defaults including an explicit null gate', () => {
  const input = manifest(); input.defaults = { widths: [390], maxDiffRatio: 0.02, keepScroll: true };
  input.cases[0].maxDiffRatio = null;
  const item = normalizeSuite(input).cases[0]; assert.deepEqual(item.widths, [390]);
  assert.equal(item.maxDiffRatio, null); assert.equal(item.keepScroll, true);
});
test('origin overrides preserve path query and fragment', () => {
  const item = normalizeSuite(manifest(), { sourceOrigin: 'http://127.0.0.1:5001', targetOrigin: 'http://127.0.0.1:5002/' }).cases[0];
  assert.equal(item.source, 'http://127.0.0.1:5001/a?q=1#faq');
  assert.equal(item.target, 'http://127.0.0.1:5002/a?q=1#faq');
});
test('case selection preserves manifest order and records excluded cases', () => {
  const input = manifest(); input.cases.push({ ...input.cases[0], id: 'second' });
  const suite = normalizeSuite(input, { only: ['second'] });
  assert.deepEqual(suite.cases.map(c => c.id), ['second']); assert.deepEqual(suite.excluded, ['home']);
  assert.throws(() => normalizeSuite(input, { only: ['missing'] }), /Unknown case/);
  assert.throws(() => normalizeSuite(input, { only: ['home', 'home'] }), /unique/);
});
for (const [name, change] of [
  ['unknown root fields', x => { x.failOnWarning = true; }],
  ['unknown defaults', x => { x.defaults = { maxDifRatio: 1 }; }],
  ['unknown case fields', x => { x.cases[0].maxDifRatio = 1; }],
  ['wrong version', x => { x.schemaVersion = 2; }],
  ['empty cases', x => { x.cases = []; }],
  ['string width', x => { x.cases[0].widths = ['390']; }],
  ['zero width', x => { x.cases[0].widths = [0]; }],
  ['oversized height', x => { x.defaults = { height: 8193 }; }],
  ['duplicate widths', x => { x.defaults = { widths: [390, 390] }; }],
  ['null widths', x => { x.defaults = { widths: null }; }],
  ['string gate', x => { x.defaults = { maxDiffRatio: '0.02' }; }],
  ['out of range gate', x => { x.defaults = { maxDiffRatio: 1.1 }; }],
  ['string boolean', x => { x.cases[0].keepScroll = 'false'; }],
  ['null scheme', x => { x.cases[0].scheme = null; }],
  ['control characters', x => { x.cases[0].state = 'bad\nlabel'; }],
  ['unsafe id', x => { x.cases[0].id = '../escape'; }],
  ['Windows reserved id', x => { x.cases[0].id = 'con'; }],
  ['duplicate ids', x => { x.cases.push({ ...x.cases[0] }); }],
  ['embedded credentials', x => { x.cases[0].source = 'https://user:pass@example.com'; }],
  ['non-HTTP URL', x => { x.cases[0].source = 'file:///tmp/private'; }],
  ['non-string URL', x => { x.cases[0].source = 123; }],
  ['executable actions', x => { x.cases[0].sourceActions = [{ type: 'evaluate', selector: 'body' }]; }],
  ['extra action fields', x => { x.cases[0].sourceActions = [{ type: 'click', selector: 'button', code: 'alert(1)' }]; }],
  ['empty selector', x => { x.cases[0].sourceActions = [{ type: 'click', selector: ' ' }]; }],
  ['too many actions', x => { x.cases[0].sourceActions = Array.from({ length: 51 }, () => ({ type: 'scroll', selector: 'footer' })); }],
  ['too many cases', x => { x.cases = Array.from({ length: 21 }, (_, i) => ({ ...x.cases[0], id: `case-${i}` })); }],
  ['too many pairs', x => { x.defaults = { widths: [100, 200, 300, 400] }; x.cases = Array.from({ length: 16 }, (_, i) => ({ ...x.cases[0], id: `case-${i}` })); }],
]) test(`rejects ${name}`, () => { const input = manifest(); change(input); assert.throws(() => normalizeSuite(input)); });
for (const value of ['https://example.com/path', 'https://example.com/?secret=1', 'https://example.com/#hash', 'https://a:b@example.com']) {
  test(`rejects non-origin override ${value}`, () => assert.throws(() => normalizeSuite(manifest(), { targetOrigin: value })));
}
test('validates even excluded cases before any output may be touched', () => {
  const input = manifest(); input.cases.push({ ...input.cases[0], id: 'second', widths: [0] });
  assert.throws(() => normalizeSuite(input, { only: ['home'] }));
});
test('constructs argv without shell parsing and retains zero threshold', () => {
  const item = { ...spec(), maxDiffRatio: 0, sourceActions: [{ type: 'click', selector: '#menu' }], keepScroll: true };
  const args = verifyArguments(item, '/tmp/path with spaces', '/tmp/chromium browser');
  assert.equal(args[args.indexOf('--source') + 1], 'https://source.example/a?q=1#faq');
  assert.equal(args[args.indexOf('--max-diff-ratio') + 1], '0');
  assert.equal(args[args.indexOf('--source-actions') + 1], '/tmp/path with spaces/source-actions.json');
  assert.equal(args[args.indexOf('--out') + 1], '/tmp/path with spaces/evidence');
  assert.ok(args.includes('--keep-scroll')); assert.ok(!args.includes('--target-actions'));
});
test('completed ungated evidence never becomes a passed visual gate', () => {
  const result = assessSuiteCase(spec(), command, evidence()); assert.equal(result.status, 'completed');
  assert.equal(summarizeSuite([result]).visualGates.not_requested, 3);
  assert.equal(summarizeSuite([result]).visualGates.passed, 0);
});
test('strict warning mode fails diagnostics without changing the pixel gate', () => {
  const report = evidence(); report.rows[0].warnings.push('source: pageErrors=1');
  assert.equal(assessSuiteCase(spec(), command, report).status, 'completed');
  const result = assessSuiteCase(spec(), command, report, true);
  assert.equal(result.status, 'failed'); assert.match(result.errors.join(' '), /warnings/);
  assert.equal(result.rows[0].visualGate, 'not_requested');
});
for (const [name, change] of [
  ['missing report', () => null],
  ['unfinished report', r => { r.status = 'running'; return r; }],
  ['wrong tool', r => { r.tool = 'other'; return r; }],
  ['missing rows', r => { r.rows = []; return r; }],
  ['extra rows', r => { r.rows.push(r.rows[0]); return r; }],
  ['duplicate widths', r => { r.rows[1].width = 1440; return r; }],
  ['different height', r => { r.rows[0].height = 901; return r; }],
  ['different source', r => { r.sourceUrl = 'https://other.example/'; return r; }],
  ['different state', r => { r.state = 'other'; return r; }],
  ['different gate', r => { r.maxDiffRatio = 0.5; return r; }],
  ['missing comparison', r => { r.rows[0].hasComparison = false; return r; }],
  ['invalid pixel ratio', r => { r.rows[0].changedPixelRatio = NaN; return r; }],
  ['contradictory visual pass', r => { r.rows[0].visualGate = 'passed'; return r; }],
  ['row error', r => { r.rows[0].errors.push('failed comparison'); return r; }],
  ['bad warning shape', r => { r.rows[0].warnings = 'not an array'; return r; }],
]) test(`does not accept ${name} as success`, () => assert.equal(assessSuiteCase(spec(), command, change(evidence())).status, 'failed'));
test('nonzero child exit cannot be masked by a successful report', () => {
  assert.equal(assessSuiteCase(spec(), { ...command, exitCode: 1 }, evidence()).status, 'failed');
  assert.equal(assessSuiteCase(spec(), { ...command, error: 'spawn failed' }, evidence()).status, 'failed');
});
test('recomputes explicit threshold results rather than trusting child labels', () => {
  const item = { ...spec(), maxDiffRatio: 0.01 }; const report = evidence(item);
  report.rows[0].changedPixelRatio = 0.02;
  assert.equal(assessSuiteCase(item, command, report).status, 'failed');
  report.rows[0].visualGate = 'failed'; report.rows[0].status = 'failed'; report.status = 'failed';
  const result = assessSuiteCase(item, { ...command, exitCode: 1 }, report);
  assert.equal(result.rows[0].visualGate, 'failed');
});
test('summary keeps pending, failed and completed cases separate', () => {
  const summary = summarizeSuite([{ status: 'pending' }, { status: 'failed' }, assessSuiteCase(spec(), command, evidence())]);
  assert.equal(summary.total, 3); assert.equal(summary.pending, 1); assert.equal(summary.failed, 1); assert.equal(summary.completed, 1);
});
test('HTML escapes evidence and never trusts a supplied report href', () => {
  const result = assessSuiteCase(spec(), command, evidence()); result.errors = ['<script>alert(1)</script>'];
  result.reportPath = 'javascript:alert(1)';
  const html = renderSuiteReport({ name: '<img onerror=alert(1)>', status: 'failed', cases: [result], excluded: [] });
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img onerror'));
  assert.ok(!html.includes('href="javascript:')); assert.match(html, /&lt;script&gt;/);
  assert.match(html, /cases\/home\/evidence\/index.html/); assert.match(html, /Content-Security-Policy/);
  assert.match(html, /not_verified/);
});

test('rejects action payloads larger than the downstream capture file limit', () => {
  const input = manifest();
  input.cases[0].sourceActions = Array.from({ length: 50 }, () => ({ type: 'click', selector: '가'.repeat(1000) }));
  assert.throws(() => normalizeSuite(input), /100 KB/);
});
test('rejects state labels the downstream CLI would interpret as flags', () => {
  const input = manifest(); input.cases[0].state = '--dark';
  assert.throws(() => normalizeSuite(input), /state/);
});
