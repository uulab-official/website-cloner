/** Shared, dependency-free contract for explicitly authored actions. */
const controls = /[\u0000-\u001f\u007f]/;
function text(value, name, max = 2000, empty = false) {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max || controls.test(value)) {
    throw new Error(`${name} must be ${empty ? 'a' : 'a nonempty'} bounded string without control characters`);
  }
}
export function normalizeActions(actions) {
  if (!Array.isArray(actions) || actions.length > 50) throw new Error('Actions must be an array of at most 50 objects');
  return actions.map((action, index) => {
    if (!action || typeof action !== 'object' || Array.isArray(action)) throw new Error(`Invalid actions entry ${index}`);
    const keys = ['type', 'selector'];
    if (action.type === 'assert') {
      keys.push('check', 'timeoutMs');
      if (!['visible', 'hidden', 'attribute'].includes(action.check)) throw new Error(`Invalid assertion check in actions entry ${index}`);
      if (action.check === 'attribute') keys.push('attribute', 'value');
    } else if (!['click', 'scroll'].includes(action.type)) throw new Error(`Actions entry ${index} type must be click, scroll or assert`);
    if (Object.keys(action).some(key => !keys.includes(key))) throw new Error(`Unknown field in actions entry ${index}`);
    text(action.selector, 'Action selector');
    const result = { type: action.type, selector: action.selector };
    if (action.type === 'assert') {
      result.check = action.check;
      if (action.check === 'attribute') {
        if (typeof action.attribute !== 'string' || !/^[A-Za-z_:][A-Za-z0-9_:.-]{0,79}$/.test(action.attribute)) throw new Error('Invalid assertion attribute name');
        text(action.value, 'Assertion value', 2000, true);
        Object.assign(result, { attribute: action.attribute, value: action.value });
      }
      if (Object.hasOwn(action, 'timeoutMs')) {
        if (!Number.isInteger(action.timeoutMs) || action.timeoutMs < 1 || action.timeoutMs > 10000) throw new Error('Assertion timeoutMs must be an integer from 1 to 10000');
        result.timeoutMs = action.timeoutMs;
      }
    }
    return result;
  });
}

/** Strip execution metadata, not any part of the expected assertion. */
export function actionDefinition(record) {
  const result = { type: record?.type, selector: record?.selector };
  if (record?.type === 'assert') {
    result.check = record.check;
    if (record.check === 'attribute') Object.assign(result, { attribute: record.attribute, value: record.value });
    if (Object.hasOwn(record, 'timeoutMs')) result.timeoutMs = record.timeoutMs;
  }
  return normalizeActions([result])[0];
}
export function assertionMatches(action, observed) {
  if (!observed || observed.count !== 1) return false;
  if (action.check === 'attribute') return observed.truncated === false && typeof observed.value === 'string' && observed.value === action.value;
  return typeof observed.visible === 'boolean' && observed.visible === (action.check === 'visible');
}

/** Validate recorded evidence; this is consistency checking, not source authentication. */
export function assertActionResults(actions, expected) {
  if (actions === undefined && expected === undefined) return; // legacy paired reports
  if (!Array.isArray(actions) || actions.length > 50) throw new Error('Invalid captured actions');
  const wanted = expected === undefined ? null : normalizeActions(expected);
  if (wanted && actions.length !== wanted.length) throw new Error('Capture actions do not match requested count');
  for (const [index, record] of actions.entries()) {
    if (record?.status !== 'completed') throw new Error(`Capture action ${index} is incomplete/failed`);
    const definition = actionDefinition(record);
    if (wanted && JSON.stringify(definition) !== JSON.stringify(wanted[index])) throw new Error(`Capture action ${index} does not match requested assertion, selector or order`);
    if (definition.type === 'assert' && (record.assertion?.status !== 'passed' || !assertionMatches(definition, record.assertion.observed))) {
      throw new Error(`Capture assertion ${index} has missing or contradictory observed evidence`);
    }
  }
}
