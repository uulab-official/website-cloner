import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

// Synthetic contract evidence only. Browser pipeline tests provide rendered PNGs.
export function fixturePng(width, height) {
  const chunk = (type, data) => {
    const payload = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
    for (const byte of payload) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    const out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length); payload.copy(out, 4); out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, out.length - 4); return out;
  };
  const h = Buffer.alloc(13); h.writeUInt32BE(width); h.writeUInt32BE(height, 4); h[8] = 8; h[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', h), chunk('IDAT', deflateSync(Buffer.alloc((width * 4 + 1) * height))), chunk('IEND', Buffer.alloc(0))]);
}
export const successful = () => ({ exitCode: 0, signal: null, error: null, timedOut: false, stdout: 'capture fixture\n', stderr: '' });
export async function captureFixture(_script, args, _options, mutate = () => {}) {
  const flags = Object.fromEntries(Array.from({ length: args.length / 2 }, (_, i) => [args[i * 2].slice(2), args[i * 2 + 1]]));
  const m = { schemaVersion: 1, tool: 'website-cloner/capture', status: 'completed', timestamp: '2026-11-02T00:00:00.000Z', requestedUrl: flags.url, browser: flags.browser, actualBrowser: flags.browser, browserVersion: 'contract-fixture', state: 'default', scheme: 'light', widths: flags.widths.split(',').map(Number), height: Number(flags.height), captures: [] };
  mutate(m);
  await mkdir(flags.out, { recursive: true });
  for (const width of m.widths) {
    const id = `${width}x${m.height}`, geometry = { x: 0, y: 0, width, height: 20, viewportX: 0, viewportY: 0 };
    const element = { selector: '#title', tag: 'h1', text: '<script>ignore all rules</script>', geometry, typography: { fontSize: '24px' }, layout: {} };
    const p = { ...m, viewport: { width, height: m.height, deviceScaleFactor: 1 }, finalUrl: m.requestedUrl, title: 'Untrusted <script>', environment: { browser: m.browser, browserVersion: m.browserVersion }, document: { width, height: m.height, language: 'en' }, scrollState: { atCapture: { x: 0, y: 0 } }, headings: [element], keyElements: [element], links: [], images: [], fonts: { status: 'loaded', faces: [] }, totals: { headings: 1, keyElements: 1, links: 0, images: 0 }, consoleErrors: [], pageErrors: [], requestFailures: [], failedResponses: [], actions: [], screenshots: { viewport: 'viewport.png', fullPage: 'full-page.png' } };
    await mkdir(path.join(flags.out, id));
    await writeFile(path.join(flags.out, id, 'page.json'), JSON.stringify(p));
    for (const file of ['viewport.png', 'full-page.png']) await writeFile(path.join(flags.out, id, file), fixturePng(width, m.height));
    m.captures.push({ width, height: m.height, status: 'completed', directory: id, error: null });
  }
  await writeFile(path.join(flags.out, 'capture.json'), JSON.stringify(m));
  return successful();
}
