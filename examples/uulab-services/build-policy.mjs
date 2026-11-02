import { lstatSync } from 'node:fs';
import path from 'node:path';

/** Guard the owned output before Vite is allowed to empty it. */
export function demoBuildPolicy(exampleDirectory) {
  const root = path.resolve(exampleDirectory);
  const output = path.resolve(root, '../../dist/demo');
  return {
    name: 'uulab-safe-build-output',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) {
      const actual = path.resolve(config.root, config.build.outDir);
      if (path.resolve(config.root) !== root || actual !== output) {
        throw new Error('Unsafe demo build output: only the original example root and dist/demo are supported. Build there, then copy the result.');
      }
      for (const directory of [path.dirname(output), output]) {
        let info;
        try { info = lstatSync(directory); }
        catch (error) { if (error.code === 'ENOENT') continue; throw error; }
        if (info.isSymbolicLink() || !info.isDirectory()) {
          throw new Error(`Unsafe demo build output: ${directory} must be a real directory, not a symlink or file.`);
        }
      }
    },
  };
}
