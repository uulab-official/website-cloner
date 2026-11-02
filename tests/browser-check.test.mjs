import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, access, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let api;
try { api = await import('../scripts/lib/browser-check.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; api = {}; }
const requireApi = () => assert.equal(typeof api.parseBrowsers, 'function', 'cross-browser selection must be implemented');
const tap = (browser='chromium') => `TAP version 13\n# CLONER_BROWSER ${JSON.stringify({name:browser,version:'1.2.3'})}\n1..2\n# tests 2\n# suites 0\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 10\n`;
const run = stdout => ({exitCode:0,signal:null,error:null,timedOut:false,stdout,stderr:''});

test('engine list defaults to three supported engines and preserves requested order', () => {
  requireApi();
  assert.deepEqual(api.parseBrowsers(), ['chromium','firefox','webkit']);
  assert.deepEqual(api.parseBrowsers('webkit, chromium'), ['webkit','chromium']);
});
for (const value of ['', 'chrome', 'safari', 'Chromium', 'chromium,chromium', 'webkit,', 'firefox,,webkit', '../chromium']) {
  test(`reject invalid engine list ${JSON.stringify(value)}`, () => { requireApi(); assert.throws(()=>api.parseBrowsers(value),/browser/i); });
}
test('default test engine and existing Chromium override remain compatible', () => {
  requireApi();
  assert.deepEqual(api.demoBrowserOptions({}), {name:'chromium',launchOptions:{headless:true}});
  assert.equal(api.demoBrowserOptions({CLONER_CHROMIUM_PATH:'/tmp/chrome'}).launchOptions.executablePath,'/tmp/chrome');
  assert.equal(api.demoBrowserOptions({CLONER_TEST_BROWSER:'firefox'}).name,'firefox');
});
for (const key of ['CLONER_CHROMIUM_PATH','CAPTURE_TEST_EXECUTABLE_PATH']) {
  test(`reject non-Chromium ${key} without silently changing engine`, () => {
    requireApi(); assert.throws(()=>api.demoBrowserOptions({CLONER_TEST_BROWSER:'webkit',[key]:'/tmp/chrome'}),/Chromium/i);
  });
}
test('reject conflicting executable paths and unknown single engine', () => {
  requireApi();
  assert.throws(()=>api.demoBrowserOptions({CLONER_CHROMIUM_PATH:'/one',CAPTURE_TEST_EXECUTABLE_PATH:'/two'}),/conflict/i);
  assert.throws(()=>api.demoBrowserOptions({CLONER_TEST_BROWSER:'chromium,firefox'}),/browser/i);
});
test('passing child must supply full counts and requested engine/version evidence', () => {
  requireApi(); const result=api.assessBrowserRun('firefox',run(tap('firefox')));
  assert.equal(result.status,'passed'); assert.equal(result.version,'1.2.3'); assert.equal(result.counts.tests,2); assert.deepEqual(result.errors,[]);
});
for (const field of ['fail','cancelled','skipped','todo']) {
  test(`a nonzero ${field} count cannot pass`, () => {
    requireApi(); assert.equal(api.assessBrowserRun('chromium',run(tap().replace(`# ${field} 0`,`# ${field} 1`))).status,'failed');
  });
}
for (const [label,change] of [
  ['missing counts', t=>t.replace('# tests 2\n','')],
  ['duplicate counts',t=>t+'# tests 2\n'],
  ['zero tests',t=>t.replace('# tests 2','# tests 0').replace('# pass 2','# pass 0')],
  ['inconsistent totals',t=>t.replace('# pass 2','# pass 1')],
  ['wrong browser',t=>t.replace('"chromium"','"webkit"')],
  ['missing version',t=>t.replace('"1.2.3"','""')],
  ['conflicting version',t=>t+'# CLONER_BROWSER {"name":"chromium","version":"other"}\n'],
  ['missing browser evidence',t=>t.replace(/^# CLONER_BROWSER.*\n/m,'')],
]) {
  test(`reject ${label}`,()=>{ requireApi(); assert.equal(api.assessBrowserRun('chromium',run(change(tap()))).status,'failed'); });
}
for (const fault of [{exitCode:1},{signal:'SIGKILL'},{error:'spawn failed'},{timedOut:true},{interrupted:true}]) {
  test(`child failure cannot pass ${JSON.stringify(fault)}`,()=>{ requireApi(); assert.equal(api.assessBrowserRun('chromium',{...run(tap()),...fault}).status,'failed'); });
}
test('dry run validates options without creating output or importing Playwright', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'cloner-browser-cli-')); const out=path.join(root,'output');
  try {
    const result=spawnSync(process.execPath,['scripts/check-browsers.mjs','--browsers','firefox,webkit','--out',out,'--dry-run'],{encoding:'utf8',env:{PATH:process.env.PATH}});
    assert.equal(result.status,0,result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).browsers,['firefox','webkit']);
    await assert.rejects(access(out));
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('process executor passes explicit environment to child without modifying parent', async () => {
  const { executeNodeScript }=await import('../scripts/lib/suite-runner.mjs');
  const result=await executeNodeScript('-e',['process.stdout.write(process.env.CLONER_TEST_BROWSER)'],{timeoutMs:2000,env:{...process.env,CLONER_TEST_BROWSER:'webkit'}});
  assert.equal(result.exitCode,0);assert.equal(result.stdout,'webkit');
});
test('larger diagnostic limit retains full TAP rather than only a tail', async () => {
  const { executeNodeScript }=await import('../scripts/lib/suite-runner.mjs');
  const result=await executeNodeScript('-e',['process.stdout.write("x".repeat(15000))'],{timeoutMs:2000,maxOutputChars:20000});
  assert.equal(result.stdout.length,15000);
});
test('invalid browser input never overwrites an existing evidence directory', async () => {
  const { writeFile, readFile }=await import('node:fs/promises');
  const out=await mkdtemp(path.join(os.tmpdir(),'cloner-protected-browser-'));
  try {
    await writeFile(path.join(out,'sentinel'),'keep me');
    const result=spawnSync(process.execPath,['scripts/check-browsers.mjs','--browsers','safari','--out',out,'--overwrite'],{encoding:'utf8'});
    assert.equal(result.status,1);assert.match(result.stderr,/browser/i);
    assert.equal(await readFile(path.join(out,'sentinel'),'utf8'),'keep me');
  } finally { await rm(out,{recursive:true,force:true}); }
});
