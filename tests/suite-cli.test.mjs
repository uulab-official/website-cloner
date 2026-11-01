import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'scripts/verify-suite.mjs');
const call = (args, script = cli) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 10000 });
const manifest = () => ({ schemaVersion: 1, sourceOrigin: 'https://source.test', targetOrigin: 'http://localhost:4173', defaults: { widths: [390] }, cases: [{ id: 'one', path: '/' }, { id: 'two', path: '/second' }] });
async function temp(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cloner-suite-cli-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'suite.json'); await writeFile(file, JSON.stringify(manifest())); return { dir, file };
}
test('help succeeds without manifest/output', () => {
  const result = call(['--help']); assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--manifest/); assert.match(result.stdout, /--dry-run/);
});
test('missing, duplicate and unknown arguments fail', () => {
  for (const args of [[], ['--what'], ['--manifest'], ['--manifest', 'x', '--manifest', 'y']]) assert.notEqual(call(args).status, 0);
});
test('dry-run validates and prints plan without creating output or launching verifier', async t => {
  const { dir, file } = await temp(t); const out = path.join(dir, 'must-not-exist');
  const result = call(['--manifest', file, '--out', out, '--dry-run', '--target-origin', 'http://localhost:5000']);
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout); assert.equal(plan.cases[0].targetUrl, 'http://localhost:5000/');
  await assert.rejects(readFile(path.join(out, 'suite.json')), /ENOENT/);
});
test('non-dry run requires output', async t => {
  const { file } = await temp(t); const result = call(['--manifest', file]);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /--out/);
});
test('invalid manifest cannot destroy owned output with overwrite', async t => {
  const { dir, file } = await temp(t); const out = path.join(dir, 'old'); await mkdir(out);
  await writeFile(path.join(out, '.website-cloner-output.json'), JSON.stringify({ schema: 'website-cloner-output/v1', tool: 'verify-suite' }));
  await writeFile(path.join(out, 'important.txt'), 'keep');
  const value = manifest(); value.cases[1].sourceActions = './missing.json'; await writeFile(file, JSON.stringify(value));
  const result = call(['--manifest', file, '--out', out, '--overwrite']);
  assert.notEqual(result.status, 0); assert.equal(await readFile(path.join(out, 'important.txt'), 'utf8'), 'keep');
});

// Isolated subprocess contract fixture, not a browser capture or fidelity test.
const stub = `
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const o=Object.fromEntries(Array.from({length:(process.argv.length-2)/2},(_,i)=>[process.argv[2+i*2].slice(2),process.argv[3+i*2]]));
const command={exitCode:0,signal:null,error:null};
const widths=o.widths.split(',').map(Number), height=Number(o.height), gate=o['max-diff-ratio']===undefined?null:Number(o['max-diff-ratio']);
await mkdir(o.out,{recursive:true});
const report={schemaVersion:1,tool:'website-cloner/verify',status:'completed',sourceUrl:o.source,targetUrl:o.target,widths,height,scheme:o.scheme,state:o.state,maxDiffRatio:gate,errors:[],commands:{source:command,target:command},rows:widths.map(width=>({width,height,status:'completed',comparable:true,sourceCaptured:true,targetCaptured:true,hasComparison:true,changedPixelRatio:0,visualGate:gate===null?'not_requested':'passed',errors:[],warnings:[],command}))};
await writeFile(path.join(o.out,'verification.json'),JSON.stringify(report));
await writeFile(path.join(o.out,'index.html'),'<title>Contract fixture; not screenshot evidence</title>');
for(const width of widths){
 const folder=width+'x'+height;
 for(const [dir,names] of [['source/'+folder,['page.json','viewport.png','full-page.png']],['target/'+folder,['page.json','viewport.png','full-page.png']],['comparisons/'+folder,['report.json','diff.png','side-by-side.png']]]){
  await mkdir(path.join(o.out,dir),{recursive:true});
  for(const name of names)await writeFile(path.join(o.out,dir,name),'contract fixture');
 }
}
if(o.source.endsWith('/fail')) process.exitCode=1;
`;
async function isolatedCli(t) {
  const context = await temp(t); const scripts = path.join(context.dir, 'tool', 'scripts');
  await mkdir(path.join(scripts, 'lib'), { recursive: true });
  for (const file of ['verify-suite.mjs', 'lib/cli.mjs', 'lib/output.mjs', 'lib/suite-config.mjs', 'lib/suite-runner.mjs']) await copyFile(path.join(root, 'scripts', file), path.join(scripts, file));
  await writeFile(path.join(scripts, 'verify.mjs'), stub);
  return { ...context, script: path.join(scripts, 'verify-suite.mjs'), out: path.join(context.dir, 'out') };
}
test('CLI orchestrates two real child processes and writes aggregate contract results', async t => {
  const { file, script, out } = await isolatedCli(t);
  const result = call(['--manifest', file, '--out', out], script);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(await readFile(path.join(out, 'suite.json'), 'utf8'));
  assert.equal(report.summary.completed, 2); assert.equal(report.summary.visualPassed, 0);
});
test('CLI propagates failing child exit while continuing', async t => {
  const { file, script, out } = await isolatedCli(t); const value = manifest(); value.cases[0].path = '/fail';
  await writeFile(file, JSON.stringify(value)); const result = call(['--manifest', file, '--out', out], script);
  assert.equal(result.status, 1); const report = JSON.parse(await readFile(path.join(out, 'suite.json'), 'utf8'));
  assert.equal(report.summary.failed, 1); assert.equal(report.summary.completed, 1);
});
test('CLI fail-fast writes skipped cases rather than concealing them', async t => {
  const { file, script, out } = await isolatedCli(t); const value = manifest(); value.cases[0].path = '/fail';
  await writeFile(file, JSON.stringify(value)); const result = call(['--manifest', file, '--out', out, '--fail-fast'], script);
  assert.equal(result.status, 1); const report = JSON.parse(await readFile(path.join(out, 'suite.json'), 'utf8'));
  assert.equal(report.summary.skipped, 1); assert.equal(report.cases.length, 2);
}
);
