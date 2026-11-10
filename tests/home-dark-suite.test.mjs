import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadSuite } from '../scripts/lib/suite-config.mjs';

const manifest = fileURLToPath(new URL('../suites/uulab-home-dark.json', import.meta.url));
const actions = filename => readFile(filename, 'utf8').then(JSON.parse);
const toggle = { type: 'click', selector: '#darkModeToggle:visible, #darkModeToggleMobile:visible' };

test('homepage dark suite preserves six explicit views and maps source root to local home', async () => {
  const plan = await loadSuite(manifest);
  assert.equal(plan.cases.length, 3);
  assert.equal(plan.cases.reduce((total, entry) => total + entry.widths.length, 0), 6);
  for (const entry of plan.cases) {
    assert.equal(entry.sourceUrl, 'https://uulab.co.kr/');
    assert.equal(entry.targetUrl, 'http://127.0.0.1:4173/home/');
    assert.equal(entry.scheme, 'light', 'the site is toggled explicitly; preference alone is not its active theme');
    assert.equal(entry.maxDiffRatio, null, 'do not manufacture a visual pass threshold');
  }
});
test('every dark view first toggles the visible site theme control on both sides', async () => {
  const plan = await loadSuite(manifest);
  for (const entry of plan.cases) {
    assert.deepEqual((await actions(entry.sourceActions))[0], toggle);
    assert.deepEqual((await actions(entry.targetActions))[0], toggle);
  }
});
test('dark menu and questions preserve their actual interaction and scroll contracts', async () => {
  const { cases } = await loadSuite(manifest);
  const menu = cases.find(entry => entry.id === 'home-dark-menu');
  const questions = cases.find(entry => entry.id === 'home-dark-questions');
  assert.deepEqual(menu.widths, [390]);
  assert.deepEqual(await actions(menu.sourceActions), [toggle, { type: 'click', selector: '.navbar-toggler' }]);
  assert.equal(questions.keepScroll, true);
  assert.deepEqual(await actions(questions.sourceActions), [toggle, { type: 'scroll', selector: '[data-home-questions]' }]);
  assert.deepEqual(await actions(questions.targetActions), [toggle, { type: 'scroll', selector: '.home-questions' }]);
});
test('checked-in dark action references stay relative and have no executable code action', async () => {
  const data = JSON.parse(await readFile(manifest, 'utf8'));
  for (const entry of data.cases) for (const side of ['sourceActions', 'targetActions']) {
    assert.equal(path.isAbsolute(entry[side]), false);
    for (const action of await actions(path.resolve(path.dirname(manifest), entry[side]))) {
      assert.deepEqual(Object.keys(action).sort(), ['selector', 'type']);
      assert.ok(['click', 'scroll'].includes(action.type));
    }
  }
});
