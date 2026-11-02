import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';

for (const directory of ['dist/demo','dist/demo/report','scripts/report','tests/report','examples/report','node_modules/report']) {
  test(`reject output overlapping code or production build: ${directory}`, () => {
    const result=spawnSync(process.execPath,['scripts/check-browsers.mjs','--out',directory,'--dry-run'],{encoding:'utf8',env:{PATH:process.env.PATH}});
    assert.equal(result.status,1,'the build must never overwrite the report or vice versa');
    assert.match(result.stderr,/output/i);
  });
}
