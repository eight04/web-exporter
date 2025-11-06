import browser from "webextension-polyfill";

export const logger = createLogger();

function createLogger() {
  let INC = 0;
  const ports = new Set();

  browser.runtime.onConnect.addListener(port => {
    if (port.name !== "logger") return;
    ports.add(port);
    port.onDisconnect.addListener(() => {
      ports.delete(port);
    });
  });

  return {
    log,
    extend
  };

  function log(message) {
    const id = ++INC;
    console.log(`[${id}] ${message}`);
    for (const port of ports) {
      port.postMessage({id, message});
    }
    return id;
  }

  function extend(id, message) {
    console.log(`[${id}] ${message}`);
    for (const port of ports) {
      port.postMessage({id, message, extend: true});
    }
  }
}
