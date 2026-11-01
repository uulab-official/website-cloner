#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseOptions, ratio, safeError } from './lib/cli.mjs';
import { prepareOutputDirectory, writeJson } from './lib/output.mjs';

const help = `Usage: node scripts/compare.mjs --source FILE --target FILE --out DIR [options]

Compare two same-size PNG screenshots without resizing them.

Options:
  --source FILE             Source PNG (required)
  --target FILE             Target PNG (required)
  --out DIR                 New or empty output run directory (required)
  --max-diff-ratio NUMBER   Optional failure limit, from 0 to 1
  --overwrite               Replace a previous comparison run in DIR
  --help                    Show this help

Outputs: diff.png, side-by-side.png, report.json.
Pixelmatch's per-pixel color threshold is 0.1. A changed-pixel ratio is
diagnostic evidence, not a semantic quality score or a functional test.
Without --max-diff-ratio, any valid same-size comparison exits successfully.
Dimension mismatches fail and are recorded; images are never resized.
`;

function validatePngHeader(buffer, label) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(signature) || buffer.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`${label} is not a valid PNG`);
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (!width || !height || width * height > 100_000_000) {
    throw new Error(`${label} PNG dimensions are invalid or exceed the 100-million-pixel safety limit`);
  }
}

async function main(argv) {
  const options = parseOptions(argv, {
    values: ['source', 'target', 'out', 'max-diff-ratio'], booleans: ['overwrite'], required: ['source', 'target', 'out'],
  });
  if (options.help) { process.stdout.write(help); return; }
  const maxDiffRatio = options['max-diff-ratio'] === undefined ? null : ratio(options['max-diff-ratio'], '--max-diff-ratio');
  const sourcePath = path.resolve(options.source);
  const targetPath = path.resolve(options.target);
  const out = await prepareOutputDirectory(options.out, {
    overwrite: options.overwrite, tool: 'compare', protectedPaths: [sourcePath, targetPath],
  });
  const report = {
    schemaVersion: 1,
    tool: 'website-cloner/compare',
    createdAt: new Date().toISOString(),
    source: sourcePath,
    target: targetPath,
    dimensions: null,
    pixelmatchThreshold: 0.1,
    includeAntiAliasing: false,
    changedPixels: null,
    totalPixels: null,
    changedPixelRatio: null,
    maxDiffRatio,
    passed: null,
    status: 'pending',
    interpretation: 'Pixel differences are diagnostic evidence, not a measure of semantic quality or proof of functional correctness.',
  };
  try {
    const [{ PNG }, { default: pixelmatch }, sourceBytes, targetBytes] = await Promise.all([
      import('pngjs'), import('pixelmatch'), readFile(sourcePath), readFile(targetPath),
    ]);
    validatePngHeader(sourceBytes, 'Source');
    validatePngHeader(targetBytes, 'Target');
    const source = PNG.sync.read(sourceBytes);
    const target = PNG.sync.read(targetBytes);
    report.dimensions = {
      source: { width: source.width, height: source.height },
      target: { width: target.width, height: target.height },
    };
    if (source.width !== target.width || source.height !== target.height) {
      report.status = 'dimension_mismatch';
      report.passed = false;
      report.error = 'Source and target dimensions differ. Capture both at the same viewport and state; no resizing was applied.';
      await writeJson(path.join(out, 'report.json'), report);
      process.stderr.write(`compare: ${report.error}\n`);
      process.exitCode = 1;
      return;
    }
    const diff = new PNG({ width: source.width, height: source.height });
    report.totalPixels = source.width * source.height;
    report.changedPixels = pixelmatch(source.data, target.data, diff.data, source.width, source.height, { threshold: 0.1, includeAA: false });
    report.changedPixelRatio = report.changedPixels / report.totalPixels;
    report.passed = maxDiffRatio === null ? null : report.changedPixelRatio <= maxDiffRatio;
    report.status = report.passed === false ? 'threshold_exceeded' : 'compared';
    const beside = new PNG({ width: source.width * 2, height: source.height });
    PNG.bitblt(source, beside, 0, 0, source.width, source.height, 0, 0);
    PNG.bitblt(target, beside, 0, 0, target.width, target.height, source.width, 0);
    await Promise.all([
      writeFile(path.join(out, 'diff.png'), PNG.sync.write(diff)),
      writeFile(path.join(out, 'side-by-side.png'), PNG.sync.write(beside)),
    ]);
    await writeJson(path.join(out, 'report.json'), report);
    process.stdout.write(`Changed pixels: ${report.changedPixels}/${report.totalPixels} (${(report.changedPixelRatio * 100).toFixed(4)}%)\nReport: ${path.join(out, 'report.json')}\n`);
    if (report.passed === false) process.exitCode = 1;
  } catch (error) {
    report.status = 'invalid_data';
    report.passed = false;
    report.error = safeError(error);
    await writeJson(path.join(out, 'report.json'), report);
    throw error;
  }
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`compare: ${safeError(error)}\nUse --help for usage.\n`);
  process.exitCode = 1;
});
