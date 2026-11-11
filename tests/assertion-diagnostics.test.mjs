import test from 'node:test';
import assert from 'node:assert/strict';
import { runAssertion } from '../scripts/lib/action-assertions.mjs';

// Deterministic transport-failure reproduction, not a real-browser claim.
test('a later attribute read timeout preserves the last complete mismatching observation', async () => {
  let calls = 0;
  const locator = { count: async () => 1, getAttribute: async () => {
    if (++calls === 1) return 'idle';
    throw new Error('simulated protocol read timeout');
  } };
  const result = await runAssertion({ locator: () => locator }, {
    type: 'assert', selector: '#state', check: 'attribute', attribute: 'data-state', value: 'ready', timeoutMs: 200,
  });
  assert.equal(calls, 2); assert.equal(result.status, 'failed');
  assert.deepEqual(result.observed, { count: 1, value: 'idle', truncated: false });
  assert.match(result.error, /protocol read timeout/);
});
