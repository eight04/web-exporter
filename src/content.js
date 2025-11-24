import browser from "webextension-polyfill";

browser.runtime.onMessage.addListener((message) => {
  switch (message.method) {
    case "spiderClick":
      return spiderClick(message);
  }
});

function spiderClick({selector}) {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (!element) {
      resolve(false);
      return;
    }
    resolve(true);
    element.click();
  });
}
