import { lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const markerName = '.website-cloner-output.json';
const markerSchema = 'website-cloner-output/v1';

function contains(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function canonicalPath(filename) {
  const absolute = path.resolve(filename);
  try {
    return await realpath(absolute);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const parent = path.dirname(absolute);
    if (parent === absolute) throw error;
    return path.join(await canonicalPath(parent), path.basename(absolute));
  }
}

export async function prepareOutputDirectory(filename, { overwrite = false, tool, protectedPaths = [] }) {
  const absolute = path.resolve(filename);
  let current;
  try { current = await lstat(absolute); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (current?.isSymbolicLink()) throw new Error('Output directory must not be a symbolic link');
  if (current && !current.isDirectory()) throw new Error('Output path must be a directory');
  const canonical = await canonicalPath(absolute);
  const cwd = await realpath(process.cwd());
  if (contains(canonical, cwd)) throw new Error('Output must not be the current working directory or one of its parents');
  for (const input of protectedPaths) {
    const inputPath = path.resolve(input);
    const inputEntry = path.join(await canonicalPath(path.dirname(inputPath)), path.basename(inputPath));
    if (contains(absolute, inputPath) || contains(canonical, inputEntry) || contains(canonical, await canonicalPath(input))) {
      throw new Error(`Output directory must not contain an input file: ${path.basename(input)}`);
    }
  }
  const entries = current ? await readdir(absolute) : [];
  if (entries.length > 0) {
    if (!overwrite) throw new Error('Output directory is nonempty; choose a new run directory or use --overwrite');
    let marker;
    try {
      const markerPath = path.join(absolute, markerName);
      if (!(await lstat(markerPath)).isFile()) throw new Error('invalid marker');
      marker = JSON.parse(await readFile(markerPath, 'utf8'));
    } catch {
      throw new Error('Refusing to overwrite a nonempty output directory not owned by this tool');
    }
    if (marker.schema !== markerSchema || marker.tool !== tool) {
      throw new Error('Refusing to overwrite an output directory owned by a different tool');
    }
    // --overwrite replaces the whole recognized evidence run. rm does not
    // follow symbolic links inside the run; input containment is checked first.
    await rm(absolute, { recursive: true });
  }
  await mkdir(absolute, { recursive: true });
  await writeJson(path.join(absolute, markerName), {
    schema: markerSchema, tool, createdAt: new Date().toISOString(),
  });
  return absolute;
}

export async function writeJson(filename, value) {
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`, { flag: 'w' });
}
