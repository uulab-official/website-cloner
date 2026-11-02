import { demoBrowserOptions } from '../../scripts/lib/browser-check.mjs';

export async function launchDemoBrowser() {
  const { name, launchOptions } = demoBrowserOptions();
  const playwright = await import('playwright');
  const browser = await playwright[name].launch(launchOptions);
  process.stdout.write(`CLONER_BROWSER ${JSON.stringify({ name, version: browser.version() })}\n`);
  return browser;
}
