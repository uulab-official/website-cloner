export function parseOptions(argv, { values = [], booleans = [], required = [] }) {
  const valueFlags = new Set(values);
  const booleanFlags = new Set([...booleans, 'help']);
  const result = {};
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--') || token === '--') throw new Error(`Unexpected argument: ${token}`);
    const separator = token.indexOf('=');
    const name = token.slice(2, separator === -1 ? undefined : separator);
    if (!valueFlags.has(name) && !booleanFlags.has(name)) throw new Error(`Unknown option: --${name}`);
    if (Object.hasOwn(result, name)) throw new Error(`Duplicate option: --${name}`);
    if (booleanFlags.has(name)) {
      if (separator !== -1) throw new Error(`--${name} does not take a value`);
      result[name] = true;
      continue;
    }
    const value = separator === -1 ? argv[++index] : token.slice(separator + 1);
    if (value === undefined || value.startsWith('--') || value.trim() === '') {
      throw new Error(`Missing value for --${name}`);
    }
    result[name] = value;
  }
  if (!result.help) {
    for (const name of required) {
      if (!Object.hasOwn(result, name)) throw new Error(`Required option missing: --${name}`);
    }
  }
  return result;
}

export function positiveInteger(value, name, maximum = 8192) {
  if (!/^\d+$/.test(String(value))) throw new Error(`${name} must be an integer from 1 to ${maximum}`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) {
    throw new Error(`${name} must be an integer from 1 to ${maximum}`);
  }
  return number;
}

export function httpUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('--url must be a valid HTTP or HTTPS URL'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('--url must use HTTP or HTTPS');
  if (url.username || url.password) throw new Error('--url must not contain embedded credentials');
  return url.href;
}

export function ratio(value, name) {
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value))) throw new Error(`${name} must be a number from 0 to 1`);
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new Error(`${name} must be a number from 0 to 1`);
  return number;
}

export function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}
