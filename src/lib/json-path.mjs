// TODO: switch to an advanced query language if needed?

const RX = /[\w$]+|\.([\w$]+)|\[(\d+)\]/y;

/**
 * Parses a string path into an array of keys.
 * Supports dot notation and bracket notation. Nothing fancy.
 * Example: "a.b[0].c" -> ["a", "b", 0, "c"]
 * @param {string} path - The string path to parse.
 * @returns {Array<string|number>} - The array of keys.
 */
function parsePath(path) {
  const keys = [];
  RX.lastIndex = 0;
  let lastIndex = 0;
  let match;
  while ((match = RX.exec(path)) !== null) {
    if (match[1]) {
      keys.push(match[1]);
    } else if (match[2]) {
      keys.push(Number(match[2]));
    } else {
      keys.push(match[0]);
    }
    lastIndex = RX.lastIndex;
  }
  if (lastIndex !== path.length) {
    throw new Error(`Invalid path: ${path}`);
  }
  return keys;
}

export function get(obj, path, defaultValue = undefined) {
  const keys = parsePath(path);
  let result = obj;
  for (const key of keys) {
    if (result && result[key] !== undefined) {
      result = result[key];
    } else {
      return defaultValue;
    }
  }
  return result;
}

export function set(obj, path, value) {
  const keys = parsePath(path);
  let current = obj;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (i === keys.length - 1) {
      current[key] = value;
    } else {
      if (current[key] === undefined) {
        current[key] = typeof keys[i + 1] === "number" ? [] : {};
      }
      current = current[key];
    }
  }
}
