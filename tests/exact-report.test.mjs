import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPair, renderReport } from '../scripts/lib/verification.mjs';
import { assessCase, renderSuiteReport } from '../scripts/lib/suite-runner.mjs';
const command={exitCode:0,signal:null,error:null};
const exact={schemaVersion:1,method:'decoded-rgba8',width:2,height:2,totalPixels:4,changedPixels:1,changedPixelRatio:0.25,identical:false,maxChannelDelta:1,meanAbsoluteChannelDelta:1/16,bounds:{x:0,y:0,width:1,height:1}};
const page=()=>({status:'completed',viewport:{width:2,height:2,deviceScaleFactor:1},state:'default',scheme:'light',reducedMotion:'reduce',environment:{browser:'chromium',browserVersion:'test',headless:true,locale:'en-US',timezoneId:'UTC',isMobile:false,hasTouch:false,freshContext:true},screenshots:{viewport:'viewport.png',animations:'disabled',caret:'hide'}});
const comparison=(extra={})=>({status:'compared',changedPixelRatio:0,maxDiffRatio:null,passed:null,...extra});
const item={id:'example',sourceUrl:'https://source.test/',targetUrl:'http://localhost/',widths:[2],height:2,scheme:'light',state:'default',maxDiffRatio:null};
function verified(pair) {return {schemaVersion:1,tool:'website-cloner/verify',...item,status:pair.status,errors:[],commands:{source:command,target:command},rows:[{width:2,height:2,...pair,sourceCaptured:true,targetCaptured:true,hasComparison:true,command}]};}

test('tolerant zero retains exact nonzero difference and warns without changing gate',()=>{
  const result=assessPair(page(),page(),comparison({exactPixels:exact}));
  assert.equal(result.status,'completed'); assert.equal(result.visualGate,'not_requested');
  assert.deepEqual(result.exactPixels,exact); assert.match(result.warnings.join(' '),/zero.*differ|differ.*zero/i);
});
test('legacy comparison lacks evidence for exact equality',()=>{
  const result=assessPair(page(),page(),comparison());
  assert.equal(result.status,'completed'); assert.equal(result.exactPixels,null);
});
for (const invalid of [null,{}, {...exact,identical:true},{...exact,totalPixels:5},{...exact,changedPixelRatio:0}]) {
  test(`paired report rejects malformed exact metrics ${JSON.stringify(invalid)}`,()=>{
    assert.equal(assessPair(page(),page(),comparison({exactPixels:invalid})).status,'failed');
  });
}
test('paired HTML labels both metrics and links a fixed local exact mask',()=>{
  const report=verified(assessPair(page(),page(),comparison({exactPixels:exact})));
  const html=renderReport(report);
  assert.match(html,/Tolerance-filtered/i); assert.match(html,/Exact RGBA/i);
  assert.match(html,/25\.000000%/); assert.match(html,/decoded RGBA.*different/i);
  assert.match(html,/comparisons\/2x2\/exact-diff\.png/);
  assert.doesNotMatch(html,/<script\b/i);
});
test('legacy HTML says not measured rather than identical',()=>{
  const html=renderReport(verified(assessPair(page(),page(),comparison())));
  assert.match(html,/Exact RGBA[^<]*not measured/i);
  assert.doesNotMatch(html,/exact-diff\.png/);
});
test('suite carries exact metrics and requires review on tolerant-zero mismatch',()=>{
  const report=verified(assessPair(page(),page(),comparison({exactPixels:exact})));
  const result=assessCase(report,item,command);
  assert.equal(result.status,'completed'); assert.equal(result.reviewRequired,true);
  assert.deepEqual(result.rows[0].exactPixels,exact);
  const html=renderSuiteReport({status:'completed',sourceOrigin:'https://source.test',targetOrigin:'http://localhost',summary:{total:1,completed:1,failed:0,skipped:0,reviewRequired:1},cases:[result]});
  assert.match(html,/Exact RGBA/i); assert.match(html,/25\.000000%/);
});
test('suite does not trust an invalid exact metric on a successful child row',()=>{
  const report=verified(assessPair(page(),page(),comparison()));
  report.rows[0].exactPixels={...exact,identical:true};
  assert.equal(assessCase(report,item,command).status,'failed');
});

test('new exact-mask evidence is required, but old reports remain compatible', async t => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const path = await import('node:path'); const {tmpdir} = await import('node:os');
  const { normalizeSuite } = await import('../scripts/lib/suite-config.mjs');
  const { runSuite } = await import('../scripts/lib/suite-runner.mjs');
  const root=await mkdtemp(path.join(tmpdir(),'exact-mask-contract-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const plan=normalizeSuite({schemaVersion:1,sourceOrigin:'https://source.test',targetOrigin:'http://localhost',defaults:{widths:[2],height:2},cases:[{id:'example',path:'/'}]}, {manifestPath:path.join(root,'suite.json')});
  await writeFile(plan.manifestPath,'{}');
  for (const withMask of [false,true]) {
    const report=await runSuite(plan,{out:path.join(root,withMask?'complete':'missing'),execute:async({item:requested,out})=>{
      await mkdir(out,{recursive:true});
      const data=verified(assessPair(page(),page(),comparison({exactPixels:exact})));
      Object.assign(data,{sourceUrl:requested.sourceUrl,targetUrl:requested.targetUrl});
      await writeFile(path.join(out,'verification.json'),JSON.stringify(data));
      // Contract files only; not rendered image evidence.
      for (const relative of ['index.html',...['source','target'].flatMap(side=>['page.json','viewport.png','full-page.png'].map(name=>`${side}/2x2/${name}`)),...['report.json','diff.png','side-by-side.png',...(withMask?['exact-diff.png']:[])].map(name=>`comparisons/2x2/${name}`)]) {
        const filename=path.join(out,relative); await mkdir(path.dirname(filename),{recursive:true}); await writeFile(filename,'contract fixture');
      }
      return command;
    }});
    assert.equal(report.status,withMask?'completed':'failed');
    if (!withMask) assert.match(report.cases[0].errors.join(' '),/exact-diff\.png/);
  }
});
