/**
 * Creates a mutex-wrapped version of the given function.
 * Ensures that only one invocation of the function runs at a time.
 * Additional invocations are queued and executed sequentially.
 *
 * @param {Function} fn - The function to be wrapped with mutex behavior.
 * @param {Object} [options] - Optional configuration object.
 * @param {number} [options.maxPending=Infinity] - Maximum number of pending invocations allowed in the queue. If set to 1, it behaves as a strict mutex. If set to 2, one invocation can be queued while another is running, and so on.
 * @returns {Function} A new function that enforces mutex behavior on the original function.
 */
export function mutex(fn, {maxPending = Infinity} = {}) {
  let p = Promise.resolve();
  let pending = 0;

  return function(...args) {
    if (pending >= maxPending) {
      return Promise.reject(new Error('Max pending tasks exceeded'));
    }
    pending++;
    const result = p
      .then(() => fn(...args))
      .finally(() => {
        pending--;
      });
    p = result.catch(() => {});
    return result;
  };
}
