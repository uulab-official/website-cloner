import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// The full gate always includes real-browser capture tests. The plain npm test
// command remains usable for fast CLI/PNG checks without installing Chromium.
const env = { ...process.env, CAPTURE_TEST_BUNDLED_BROWSER: '1' };
if (env.CLONER_CHROMIUM_PATH) env.CAPTURE_TEST_EXECUTABLE_PATH = env.CLONER_CHROMIUM_PATH;
const tests = (await readdir('tests')).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>path.join('tests',name));
const commands = [
  ['scripts/validate-skill.mjs'],
  ['--test', ...tests],
  ['node_modules/vite/bin/vite.js', 'build', 'examples/uulab-services', '--outDir', '../../dist/demo'],
  ['tests/demo.e2e.mjs'],
];
for (const args of commands) {
  process.stdout.write(`\n> node ${args.join(' ')}\n`);
  const result=spawnSync(process.execPath,args,{stdio:'inherit',env});
  if (result.error) { process.stderr.write(`${result.error.message}\n`); process.exit(1); }
  if (result.status!==0) process.exit(result.status || 1);
}
