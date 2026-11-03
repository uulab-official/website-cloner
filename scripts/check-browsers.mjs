#!/usr/bin/env node
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseOptions, safeError } from './lib/cli.mjs';
import { prepareOutputDirectory, writeJson } from './lib/output.mjs';
import { executeNodeScript } from './lib/suite-runner.mjs';
import { parseBrowsers, demoBrowserOptions, assessBrowserRun } from './lib/browser-check.mjs';

const testFiles = ['tests/demo-controls.test.mjs', 'tests/demo-scroll.test.mjs', 'tests/demo-progress.test.mjs', 'tests/home-browser.test.mjs', 'tests/home-layout.test.mjs', 'tests/demo.e2e.mjs'];
const help = `Usage: npm run check:browsers -- [--browsers chromium,firefox,webkit] [--out DIR] [--dry-run] [--overwrite]
Build the authored demo once, then run the same local behavior tests in each engine.
Install first: npx playwright install chromium firefox webkit
No live-source capture, Safari/device certification, or backend parity is implied.
For source comparisons use capture/verify/verify:suite with --browser. Executable overrides are
accepted only for a chromium-only run. Output defaults to artifacts/browser-check.
`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function html(report) {
  const rows=report.browsers.map(row=>`<tr><td>${escape(row.name)}</td><td>${escape(row.version || 'not measured')}</td><td>${escape(row.status)}</td><td>${escape(row.counts?.pass ?? '—')} / ${escape(row.counts?.tests ?? '—')}</td><td><a href="${row.name}/tests.log">Test log</a> · <a href="${row.name}/evidence.json">Production views</a></td></tr>`).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Website Cloner — browser behavior checks</title><style>body{max-width:1000px;margin:auto;padding:32px;font:16px/1.6 system-ui}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:12px;border-bottom:1px solid}p,li{overflow-wrap:anywhere}</style><h1>Browser behavior checks</h1><p>Status: <strong>${escape(report.status)}</strong></p><p>Authored demo only. Screenshots are implementation evidence, not comparisons with the source. Linux WebKit is not branded Safari, a physical iPhone, or a touch-device test. For source comparisons, capture/verify/verify:suite support --browser chromium, firefox, or webkit. This report does not compare the source.</p><table><tr><th>Engine</th><th>Version</th><th>Status</th><th>Passed / tests</th><th>Evidence</th></tr>${rows}</table><ul>${report.browsers.flatMap(row=>row.errors.map(error=>`<li>${escape(row.name)}: ${escape(error)}</li>`)).join('')}</ul><p><a href="browser-check.json">Complete results</a> · <a href="build.log">Build log</a></p></html>\n`;
}
async function canonical(filename) {
  const absolute=path.resolve(filename);
  try { return await realpath(absolute); }
  catch(error) {
    if(error.code!=='ENOENT')throw error;
    const parent=path.dirname(absolute);
    if(parent===absolute)throw error;
    return path.join(await canonical(parent),path.basename(absolute));
  }
}
function contains(parent,child) {
  const relative=path.relative(parent,child);
  return relative==='' || (relative!=='..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
async function main(argv) {
  const options=parseOptions(argv,{values:['browsers','out'],booleans:['dry-run','overwrite']});
  if(options.help){ process.stdout.write(help); return; }
  const names=parseBrowsers(options.browsers);
  for(const name of names) demoBrowserOptions({...process.env,CLONER_TEST_BROWSER:name});
  const plan={browsers:names,tests:testFiles,build:'vite build examples/uulab-services --outDir ../../dist/demo',out:path.resolve(options.out || 'artifacts/browser-check')};
  const canonicalOut=await canonical(plan.out);
  for(const protectedDirectory of ['scripts','tests','examples','node_modules','dist/demo']) {
    const protectedPath=await canonical(protectedDirectory);
    if(contains(protectedPath,canonicalOut) || contains(canonicalOut,protectedPath))throw new Error(`Output must not overlap ${protectedDirectory}`);
  }
  if(options['dry-run']) { process.stdout.write(JSON.stringify(plan,null,2)+'\n'); return; }
  const out=await prepareOutputDirectory(plan.out,{overwrite:options.overwrite,tool:'browser-check',protectedPaths:['scripts','tests','examples','package.json','package-lock.json','node_modules',...['CLONER_CHROMIUM_PATH','CAPTURE_TEST_EXECUTABLE_PATH'].map(key=>process.env[key]).filter(Boolean)]});
  const report={schemaVersion:1,tool:'website-cloner/browser-check',timestamp:new Date().toISOString(),status:'running',platform:process.platform,requestedBrowsers:names,tests:testFiles,liveSourceComparison:false,physicalDeviceVerified:false,browsers:names.map(name=>({name,status:'pending',errors:[]}))};
  const save=async()=>{await writeJson(path.join(out,'browser-check.json'),report);await writeFile(path.join(out,'index.html'),html(report));};
  await save();
  const build=await executeNodeScript('node_modules/vite/bin/vite.js',['build','examples/uulab-services','--outDir','../../dist/demo'],{timeoutMs:120000,maxOutputChars:1000000});
  report.build=build;
  await writeFile(path.join(out,'build.log'),build.stdout+'\n'+build.stderr);
  if(build.exitCode!==0 || build.error || build.signal || build.timedOut || build.interrupted) {
    report.status='failed';
    report.browsers.forEach(row=>{row.status='not_run';row.errors=['Production build failed; tests were not run'];});
    await save(); process.exitCode=1; return;
  }
  for(const [index,name] of names.entries()) {
    const directory=path.join(out,name);await mkdir(directory);
    process.stdout.write(`\n> ${name}: local demo behavior checks\n`);
    const command=await executeNodeScript('--test',['--test-reporter=tap','--test-concurrency=1',...testFiles],{timeoutMs:240000,maxOutputChars:1000000,env:{...process.env,CLONER_TEST_BROWSER:name,CAPTURE_TEST_BUNDLED_BROWSER:'1',CLONER_DEMO_EVIDENCE_DIR:directory}});
    await writeFile(path.join(directory,'tests.log'),command.stdout+'\n'+command.stderr);
    process.stdout.write(command.stdout);process.stderr.write(command.stderr);
    report.browsers[index]={...assessBrowserRun(name,command),command:{exitCode:command.exitCode,signal:command.signal,error:command.error,timedOut:command.timedOut,interrupted:Boolean(command.interrupted)}};
    await save();
    if(command.interrupted) {
      for(const row of report.browsers.slice(index+1)){row.status='not_run';row.errors=['Interrupted before execution'];}
      break;
    }
  }
  report.status=report.browsers.every(row=>row.status==='passed')?'passed':'failed';
  report.finishedAt=new Date().toISOString();await save();
  if(report.status!=='passed')process.exitCode=1;
}
main(process.argv.slice(2)).catch(error=>{process.stderr.write(safeError(error)+'\n');process.exitCode=1;});
