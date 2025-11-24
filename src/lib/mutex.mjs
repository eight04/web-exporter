export function mutex(fn, {maxPending = Infinity} = {}) {
  let p = Promise.resolve();
  let pending = 0;

  return function(...args) {
    if (pending >= maxPending) {
      return Promise.reject(new Error('Max pending tasks exceeded'));
    }
    pending++;
    const result = p.then(() => {
      pending--;
      return fn(...args);
    });
    p = result.catch(() => {});
    return result;
  };
}
