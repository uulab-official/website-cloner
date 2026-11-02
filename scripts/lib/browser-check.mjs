import path from 'node:path';

export const supportedBrowsers = Object.freeze(['chromium', 'firefox', 'webkit']);
export function parseBrowsers(value = supportedBrowsers.join(',')) {
  if (typeof value !== 'string') throw new Error('Browser list must be a comma-separated string');
  const names = value.split(',').map(name => name.trim());
  if (!names.length || new Set(names).size !== names.length || names.some(name => !supportedBrowsers.includes(name))) {
    throw new Error('Browsers must be unique names from chromium,firefox,webkit');
  }
  return names;
}

/** Test-only selection. Capture/verify commands remain Chromium-only. */
export function demoBrowserOptions(env = process.env) {
  const name = env.CLONER_TEST_BROWSER ?? 'chromium';
  if (!supportedBrowsers.includes(name)) throw new Error('Test browser must be chromium, firefox or webkit');
  const paths = [env.CLONER_CHROMIUM_PATH, env.CAPTURE_TEST_EXECUTABLE_PATH].filter(Boolean).map(value => path.resolve(value));
  if (paths.length && name !== 'chromium') throw new Error('Chromium executable overrides cannot be used with Firefox or WebKit');
  if (new Set(paths).size > 1) throw new Error('Conflicting Chromium executable overrides');
  return { name, launchOptions: { headless: true, ...(paths.length ? { executablePath: paths[0] } : {}) } };
}

/** Require complete node:test TAP evidence; exit zero alone is not a pass. */
export function assessBrowserRun(name, command) {
  const errors = [], counts = {};
  const stdout = command?.stdout || '';
  if (!command || command.exitCode !== 0 || command.signal || command.error || command.timedOut || command.interrupted) {
    errors.push(command?.error || `Browser test process failed (exit=${command?.exitCode ?? 'none'})`);
  }
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const matches = [...stdout.matchAll(new RegExp(`^# ${key} (\\d+)\\r?$`, 'gm'))];
    if (matches.length !== 1 || !Number.isSafeInteger(Number(matches[0][1]))) errors.push(`Missing or duplicate test count: ${key}`);
    else counts[key] = Number(matches[0][1]);
  }
  if (!(counts.tests > 0) || counts.pass !== counts.tests || ['fail', 'cancelled', 'skipped', 'todo'].some(key => counts[key] !== 0)) {
    errors.push('Every requested test must pass; zero, failed, cancelled, skipped or todo tests are not a pass');
  }
  const versions = [];
  for (const match of stdout.matchAll(/^# CLONER_BROWSER (.+)\r?$/gm)) {
    try {
      const info = JSON.parse(match[1]);
      if (info.name !== name || typeof info.version !== 'string' || !info.version.trim()) throw new Error();
      versions.push(info.version);
    } catch { errors.push('Invalid or mismatched browser version evidence'); }
  }
  if (!versions.length || new Set(versions).size !== 1) errors.push('Missing or inconsistent browser versions');
  return { name, version: versions[0] || null, status: errors.length ? 'failed' : 'passed', counts, errors };
}
