import { normalizeActions, assertActionResults } from './action-contract.mjs';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const controls = /[\u0000-\u001f\u007f]/;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function label(value, name, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || controls.test(value)) {
    throw new Error(`${name} must be a nonempty string of at most ${max} characters without control characters`);
  }
}
async function regularBytes(filename, limit) {
  const info = await lstat(filename);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 1 || info.size > limit) {
    throw new Error('State evidence/actions must be a regular nonempty file within its size limit, not a symbolic link');
  }
  const bytes = await readFile(filename);
  if (bytes.length > limit) throw new Error('State evidence/actions exceeds its size limit');
  return bytes;
}
async function actionSnapshot(filename, relativePath) {
  label(filename, 'actions path', 8192);
  const bytes = await regularBytes(path.resolve(filename), 100000);
  let actions;
  try { actions = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('Actions must contain valid JSON'); }
  actions = normalizeActions(actions);
  // Preserve every expected state field in portable canonical bytes.
  const content = `${JSON.stringify(actions, null, 2)}\n`;
  if (Buffer.byteLength(content) > 100000) throw new Error('Canonical actions snapshot exceeds the 100000 byte capture size limit');
  return { path: relativePath, content, actions, sha256: hash(content), count: actions.length };
}

/** Offline validation only; snapshots never retain the caller's absolute file path. */
export async function planPreparationState({ state = 'default', scheme = 'light', keepScroll = false, actions, targetActions } = {}) {
  label(state, 'state', 120);
  if (!['light', 'dark'].includes(scheme)) throw new Error('scheme must be light or dark');
  if (typeof keepScroll !== 'boolean') throw new Error('keepScroll must be boolean');
  if (targetActions !== undefined && actions === undefined) throw new Error('targetActions requires a source actions file');
  const source = actions === undefined ? null : await actionSnapshot(actions, 'actions/source.json');
  const target = targetActions === undefined ? source : await actionSnapshot(targetActions, 'actions/target.json');
  return { state, scheme, keepScroll, source, target, snapshots: [source, ...(target !== source ? [target] : [])].filter(Boolean) };
}
export function preparationStateRecord(plan) {
  const metadata = snapshot => snapshot ? { path: snapshot.path, sha256: snapshot.sha256, count: snapshot.count } : null;
  return { state: plan.state, scheme: plan.scheme, keepScroll: plan.keepScroll,
    sourceActions: metadata(plan.source), targetActions: metadata(plan.target),
    sharedActions: Boolean(plan.source && plan.source === plan.target), targetActionsVerified: false };
}

/** Only configure a workspace that initializeProject just exclusively created. */
export async function writePreparationState(out, suite, plan) {
  if (plan.snapshots.length) {
    await mkdir(path.join(out, 'actions'));
    for (const snapshot of plan.snapshots) await writeFile(path.join(out, snapshot.path), snapshot.content, { flag: 'wx' });
  }
  if (plan.state === 'default' && plan.scheme === 'light' && !plan.keepScroll && !plan.source) return;
  const entry = suite.cases[0];
  Object.assign(entry, { state: plan.state, scheme: plan.scheme, keepScroll: plan.keepScroll });
  if (plan.source) Object.assign(entry, { sourceActions: plan.source.path, targetActions: plan.target.path });
  const temp = path.join(out, 'suite.json.next');
  await writeFile(temp, `${JSON.stringify(suite, null, 2)}\n`, { flag: 'wx' });
  await rename(temp, path.join(out, 'suite.json'));
}

/** Exit zero and a matching label do not prove the requested actions ran. */
export async function assertPreparationState(out, report, plan) {
  for (const snapshot of plan.snapshots) {
    if (hash(await regularBytes(path.join(out, snapshot.path), 300000)) !== snapshot.sha256) throw new Error('Action snapshot hash changed during preparation');
  }
  const captureRoot = path.join(out, 'source');
  const manifestBytes = await regularBytes(path.join(captureRoot, 'capture.json'), 8 * 1024 * 1024);
  if (hash(manifestBytes) !== report.evidence.manifest.sha256) throw new Error('Capture manifest changed after validation');
  const manifest = JSON.parse(manifestBytes);
  // Legacy default fixtures can omit the flag. Explicit true may never be omitted.
  if ((manifest.keepScroll ?? false) !== plan.keepScroll) throw new Error('Capture keepScroll does not match request');
  const expected = plan.source?.actions ?? [];
  for (const [index, view] of report.views.entries()) {
    const bytes = await regularBytes(path.join(captureRoot, view.id, 'page.json'), 8 * 1024 * 1024);
    if (hash(bytes) !== report.evidence.pages[index].sha256) throw new Error('Capture page changed after validation');
    const page = JSON.parse(bytes);
    if ((page.scrollState?.keepScroll ?? false) !== plan.keepScroll) throw new Error('Page keepScroll does not match request');
    assertActionResults(page.actions, expected);
  }
}
