import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat, symlink, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadSuite } from '../scripts/lib/suite-config.mjs';
import { captureFixture } from './helpers/preparation-fixture.mjs';
let prepareSuite;
try { ({ prepareSuite } = await import('../scripts/lib/prepare-suite.mjs')); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const json = async f => JSON.parse(await readFile(f, 'utf8'));
const hash = b => createHash('sha256').update(b).digest('hex');
async function fixture(t) {
  assert.equal(typeof prepareSuite, 'function', 'prepareSuite API must exist');
  const dir = await mkdtemp(path.join(tmpdir(), 'prepare-suite-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const actions = path.join(dir, 'actions.json'), targetActions = path.join(dir, 'target.json');
  await writeFile(actions, '[{"type":"click","selector":"#menu"}]');
  await writeFile(targetActions, '[{"type":"click","selector":"#rebuilt-menu"}]');
  const input = { schemaVersion: 1, sourceOrigin: 'https://source.test', targetOrigin: 'http://127.0.0.1:9', defaults: { widths: [120], height: 80 }, cases: [
    { id: 'home', path: '/', targetPath: '/rebuilt/?a=1', maxDiffRatio: 0.04, timeoutMs: 1200000 },
    { id: 'menu', path: '/services/?a=2', targetPath: '/other/', sourceActions: 'actions.json', targetActions: 'target.json', state: 'menu-open', scheme: 'dark', keepScroll: true, widths: [120,240] },
  ] };
  const manifest = path.join(dir, 'input.json'); await writeFile(manifest, JSON.stringify(input));
  return { dir, manifest, out: path.join(dir, 'new/batch'), input, actions, targetActions };
}
async function capture(script, args, options, change = () => {}) {
  const flags = {}; for (let i=0;i<args.length;i++) if (args[i] === '--keep-scroll') flags.keepScroll = true; else flags[args[i++].slice(2)] = args[i];
  const result = await captureFixture(script, args.filter(a=>a !== '--keep-scroll'), options, m => { m.state=flags.state; m.scheme=flags.scheme; m.keepScroll=Boolean(flags.keepScroll); });
  const m = await json(path.join(flags.out, 'capture.json'));
  const actions = flags.actions ? await json(flags.actions) : [];
  for (const row of m.captures) {
    const file=path.join(flags.out,row.directory,'page.json'), p=await json(file);
    p.actions=actions.map(a=>({...a,status:'completed'})); p.scrollState.keepScroll=m.keepScroll;
    change(m,p); await writeFile(file,JSON.stringify(p));
  }
  await writeFile(path.join(flags.out,'capture.json'),JSON.stringify(m)); return result;
}
test('dry-run describes every case without directories or network', async t=>{
  const f=await fixture(t), r=await prepareSuite({...f,dryRun:true},{execute:()=>assert.fail('launch')});
  assert.equal(r.status,'planned'); assert.equal(r.networkAccess,false); assert.equal(r.targetVisited,false);
  assert.equal(r.cases.length,2); assert.equal(r.summary.plannedViews,3); assert.equal(r.summary.notRun,2);
  assert.equal(r.inputManifestSha256,hash(await readFile(f.manifest)));
  await assert.rejects(stat(path.dirname(f.out)),{code:'ENOENT'});
});
for (const [label,edit] of [
  ['unknown field', x=>{x.unknown=true;}], ['duplicate IDs',x=>{x.cases[1].id='HOME';}],
  ['path traversal',x=>{x.cases[1].path='/../secret';}], ['off-origin',x=>{x.cases[1].path='//other.test/';}],
  ['missing late actions',x=>{x.cases[1].sourceActions='missing.json';}], ['target-only actions',x=>{delete x.cases[1].sourceActions;}],
  ['unsafe IDs',x=>{x.cases[1].id='../bad';}], ['empty case list',x=>{x.cases=[];}],
]) test(`all-case preflight rejects ${label} without first capture or writes`,async t=>{
  const f=await fixture(t); edit(f.input); await writeFile(f.manifest,JSON.stringify(f.input));
  await assert.rejects(prepareSuite(f,{execute:()=>assert.fail('launch')}));
  await assert.rejects(stat(path.dirname(f.out)),{code:'ENOENT'});
});
for (const content of ['{','{}','[{"type":"evaluate","selector":"x"}]','[{"type":"click","selector":" "}]',' '.repeat(100001)]) test(`invalid queued actions rejected: ${content.slice(0,30)}`,async t=>{
  const f=await fixture(t); await writeFile(f.actions,content); await assert.rejects(prepareSuite(f,{execute:()=>assert.fail('launch')}));
  await assert.rejects(stat(path.dirname(f.out)),{code:'ENOENT'});
});
test('manifest and action symlinks rejected before side effects',async t=>{
  const f=await fixture(t), link=path.join(f.dir,'alias.json'); await symlink(f.manifest,link);
  await assert.rejects(prepareSuite({...f,manifest:link,dryRun:true}));
  await rm(f.actions); await symlink(f.targetActions,f.actions);
  await assert.rejects(prepareSuite({...f,dryRun:true}));
});
for (const overrides of [{browser:'safari'},{timeoutMs:999},{timeoutMs:900001},{dryRun:'yes'},{failFast:'yes'}]) test(`invalid options fail preflight ${JSON.stringify(overrides)}`,async t=>{
  const f=await fixture(t); await assert.rejects(prepareSuite({...f,...overrides},{execute:()=>assert.fail('launch')}));
  await assert.rejects(stat(path.dirname(f.out)),{code:'ENOENT'});
});
test('existing empty directory, output symlink and toolkit source are protected',async t=>{
  const f=await fixture(t); await mkdir(f.out,{recursive:true});
  await assert.rejects(prepareSuite(f),/exist|new/i);
  const link=path.join(f.dir,'linked'); await symlink(f.out,link); await assert.rejects(prepareSuite({...f,out:link}));
  await assert.rejects(prepareSuite({...f,out:path.resolve('scripts/never-create-batch')}),/protect/i);
});
test('successful batch is source-only, ordered and preserves the full reusable manifest',async t=>{
  const f=await fixture(t), launched=[];
  const r=await prepareSuite(f,{execute:(s,a,o)=>{launched.push(a[a.indexOf('--url')+1]); assert.equal(o.timeoutMs,300000); return capture(s,a,o);}});
  assert.equal(r.status,'prepared'); assert.deepEqual(launched,['https://source.test/','https://source.test/services/?a=2']);
  assert.equal(r.summary.prepared,2); assert.equal(r.summary.failed,0); assert.equal(r.summary.preparedViews,3);
  assert.equal(r.targetVisited,false); assert.equal(r.functionalParity,'not_verified'); assert.equal(r.visualComparison,'not_performed'); assert.equal(r.reviewRequired,true);
  const generated=await loadSuite(path.join(f.out,'suite.json'));
  assert.equal(generated.cases[0].maxDiffRatio,0.04); assert.equal(generated.cases[0].timeoutMs,1200000);
  assert.equal(generated.cases[0].targetUrl,'http://127.0.0.1:9/rebuilt/?a=1');
  assert.equal(generated.cases[1].scheme,'dark'); assert.equal(generated.cases[1].keepScroll,true);
  assert.match(await readFile(path.join(f.out,'START-HERE.md'),'utf8'),/verify:suite/);
  assert.deepEqual((await json(path.join(f.out,'preparation-suite.json'))).summary,r.summary);
});
test('all action snapshots are frozen before the first capture and survive relocation',async t=>{
  const f=await fixture(t); let count=0;
  const r=await prepareSuite(f,{execute:async(...args)=>{ if(!count++){await writeFile(f.actions,'[]');await writeFile(f.targetActions,'[]');await writeFile(f.manifest,'{}');} return capture(...args); }});
  assert.equal(r.status,'prepared'); const moved=path.join(f.dir,'moved'); await rename(f.out,moved);
  const s=await loadSuite(path.join(moved,'suite.json')), c=s.cases[1];
  assert.equal((await json(c.sourceActions))[0].selector,'#menu'); assert.equal((await json(c.targetActions))[0].selector,'#rebuilt-menu');
  assert.ok(!JSON.stringify(await json(path.join(moved,'suite.json'))).includes(f.dir));
  assert.equal((await json(path.join(moved,'cases/menu/source/120x80/page.json'))).actions[0].selector,'#menu');
});
test('continues after failure without dropping failed cases from suite',async t=>{
  const f=await fixture(t); let count=0;
  const r=await prepareSuite(f,{execute:(s,a,o)=>++count===1?Promise.resolve({exitCode:1,error:'HTTP 503'}):capture(s,a,o)});
  assert.equal(r.status,'failed'); assert.deepEqual(r.cases.map(c=>c.status),['failed','prepared']);
  assert.equal(r.summary.failed,1); assert.equal(r.summary.prepared,1); assert.equal((await loadSuite(path.join(f.out,'suite.json'))).cases.length,2);
});
test('fail-fast leaves the remaining case explicitly not_run',async t=>{
  const f=await fixture(t); let count=0;
  const r=await prepareSuite({...f,failFast:true},{execute:async()=>{count++;return {exitCode:1,error:'HTTP 503'};}});
  assert.equal(count,1); assert.equal(r.status,'failed'); assert.deepEqual(r.cases.map(c=>c.status),['failed','not_run']); assert.equal(r.summary.notRun,1);
  await assert.rejects(stat(path.join(f.out,'cases/menu')),{code:'ENOENT'});
});
test('interruption stops queued work even without fail-fast',async t=>{
  const f=await fixture(t); let count=0;
  const r=await prepareSuite(f,{execute:async()=>{count++;return {exitCode:null,interrupted:true,signal:'SIGKILL',error:'Interrupted by SIGINT'};}});
  assert.equal(count,1); assert.equal(r.interrupted,true); assert.equal(r.cases[1].status,'not_run'); assert.equal(r.status,'failed');
});
test('capture deadline is independent of future verifier timeout',async t=>{
  const f=await fixture(t); await prepareSuite({...f,timeoutMs:1000},{execute:(s,a,o)=>{assert.equal(o.timeoutMs,1000);return capture(s,a,o);}});
  assert.equal((await loadSuite(path.join(f.out,'suite.json'))).cases[0].timeoutMs,1200000);
});
test('mutated batch action snapshot prevents readiness and queued execution',async t=>{
  const f=await fixture(t); let count=0;
  const r=await prepareSuite(f,{execute:async(...args)=>{count++;const s=await loadSuite(path.join(f.out,'suite.json'));await writeFile(s.cases[1].sourceActions,'[]');return capture(...args);}});
  assert.equal(r.status,'failed'); assert.equal(r.cases[1].status,'failed'); assert.equal(count,1);
});
test('exit zero without capture evidence is not prepared',async t=>{
  const f=await fixture(t); const r=await prepareSuite(f,{execute:async()=>({exitCode:0})});
  assert.equal(r.status,'failed'); assert.equal(r.summary.prepared,0); assert.equal(r.summary.failed,2);
});
test('hostile labels and errors stay inert in HTML',async t=>{
  const f=await fixture(t); f.input.cases[1].state='<script>alert(1)</script>';await writeFile(f.manifest,JSON.stringify(f.input));
  const r=await prepareSuite(f,{execute:async()=>({exitCode:1,error:'<img src=https://evil.test onerror=alert(1)>'})});
  assert.equal(r.status,'failed');const html=await readFile(path.join(f.out,'index.html'),'utf8');
  assert.ok(!/<script|<iframe|<img|<video|<audio/i.test(html)); assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img/);assert.match(html,/default-src 'none'/);
});
test('CLI help and dry-run are dependency-free and validate unknown flags',async t=>{
  const f=await fixture(t), run=args=>spawnSync(process.execPath,['scripts/prepare-suite.mjs',...args],{encoding:'utf8'});
  assert.equal(run(['--help']).status,0);const r=run(['--manifest',f.manifest,'--out',f.out,'--dry-run']);
  assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).status,'planned');
  assert.equal(run(['--manifest',f.manifest,'--out',f.out,'--overwrite']).status,1);
  await assert.rejects(stat(path.dirname(f.out)),{code:'ENOENT'});
});
test('final integrity failure is visible even when all case captures completed',async t=>{
  const f=await fixture(t);let count=0;
  const r=await prepareSuite(f,{execute:async(...args)=>{const result=await capture(...args);if(++count===2)await writeFile(path.join(f.out,'suite.json'),'{}');return result;}});
  assert.equal(r.status,'failed');assert.ok(r.integrityError);assert.equal(r.summary.prepared,2);
  assert.match(await readFile(path.join(f.out,'index.html'),'utf8'),/Integrity check failed/);
});
test('shared actions keep the same relative path and no duplicate target snapshot',async t=>{
  const f=await fixture(t);delete f.input.cases[1].targetActions;await writeFile(f.manifest,JSON.stringify(f.input));
  const r=await prepareSuite(f,{execute:capture});assert.equal(r.status,'prepared');assert.equal(r.actionSnapshots.length,1);
  const c=(await loadSuite(path.join(f.out,'suite.json'))).cases[1];assert.equal(c.sourceActions,c.targetActions);
});
for (const content of ['{',' '.repeat(1000001)]) test(`bad manifest ${content.length} bytes rejected before writes`,async t=>{
  const f=await fixture(t);await writeFile(f.manifest,content);await assert.rejects(prepareSuite(f,{execute:()=>assert.fail('launch')}));await assert.rejects(stat(path.dirname(f.out)),{code:'ENOENT'});
});
test('capture misreport is not promoted to prepared batch',async t=>{
  const f=await fixture(t);const r=await prepareSuite(f,{execute:(s,a,o)=>capture(s,a,o,(_m,p)=>{p.scheme='wrong';})});
  assert.equal(r.status,'failed');assert.equal(r.summary.prepared,0);
});
