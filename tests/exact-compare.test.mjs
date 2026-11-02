import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PNG } from 'pngjs';
async function check(t, color, width=2) {
  const dir=await mkdtemp(path.join(tmpdir(),'exact-compare-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const source=new PNG({width:2,height:2}); const target=new PNG({width,height:2});
  for(let i=0;i<source.data.length;i+=4) source.data.set([255,255,255,255],i);
  for(let i=0;i<target.data.length;i+=4) target.data.set(color,i);
  await writeFile(path.join(dir,'source.png'),PNG.sync.write(source));
  await writeFile(path.join(dir,'target.png'),PNG.sync.write(target));
  const out=path.join(dir,'out');
  const run=spawnSync(process.execPath,['scripts/compare.mjs','--source',path.join(dir,'source.png'),'--target',path.join(dir,'target.png'),'--out',out,'--max-diff-ratio','0'],{encoding:'utf8',timeout:15000});
  return {run,out,report:JSON.parse(await readFile(path.join(out,'report.json'),'utf8'))};
}
test('real PNG low-contrast differences are not labelled identical at tolerant zero',async t=>{
  const {run,out,report}=await check(t,[254,255,255,255]);
  assert.equal(run.status,0,run.stderr); assert.equal(report.changedPixelRatio,0);
  assert.equal(report.passed,true,'Existing explicitly requested tolerant gate is unchanged');
  assert.equal(report.exactPixels?.changedPixels,4); assert.equal(report.exactPixels?.identical,false);
  assert.equal(report.exactPixels.changedPixelRatio,1);
  const mask=PNG.sync.read(await readFile(path.join(out,'exact-diff.png')));
  assert.deepEqual([...mask.data],Array(16).fill(255));
  assert.match(run.stdout,/Exact RGBA.*4\/4/); assert.match(run.stdout,/zero.*identical/i);
});
test('real identical PNGs have a black opaque exact mask',async t=>{
  const {run,out,report}=await check(t,[255,255,255,255]);
  assert.equal(run.status,0,run.stderr); assert.equal(report.exactPixels?.identical,true);
  assert.equal(report.exactPixels.changedPixels,0); assert.equal(report.exactPixels.bounds,null);
  assert.deepEqual([...PNG.sync.read(await readFile(path.join(out,'exact-diff.png'))).data],Array.from({length:4},()=>[0,0,0,255]).flat());
});
test('alpha-only differences are recorded independently of tolerant comparison',async t=>{
  const {report}=await check(t,[255,255,255,254]);
  assert.equal(report.exactPixels?.changedPixels,4); assert.equal(report.exactPixels.maxChannelDelta,1);
});
test('dimension mismatch retains null exact metrics and creates no exact mask',async t=>{
  const {run,out,report}=await check(t,[255,255,255,255],1);
  assert.equal(run.status,1); assert.equal(report.status,'dimension_mismatch');
  assert.equal(report.exactPixels,null); await assert.rejects(readFile(path.join(out,'exact-diff.png')));
});
