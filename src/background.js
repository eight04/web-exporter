// import webextMenus from "webext-menus";
import browser from "webextension-polyfill";

import {extractor} from "./lib/extrator.mjs";
import sites from "./sites/index.mjs";

// this is used to log error raised by onMessage handler,
// otherwise the stack trace will be removed after passing the error to the content script.
function logError(fn) {
  return (...args) => {
    try {
      const result = fn(...args);
      if (!result || !result.catch) return result;
      return result.catch(err => {
        console.error(err);
        throw err;
      });
    } catch (err) {
      console.error(err);
      throw err;
    }
  };
}

browser.runtime.onMessage.addListener(logError((message, sender) => {
	switch (message.method) {
		case "closeTab":
			if (!message.tabId) {
				message.tabId = sender.tab.id;
			}
			return closeTab(message);
		case "notifyError":
			return notifyError(message.error);
    // case "openDialog":
    //   return createDialog(message);
    case "startRecording":
      return extractor.start();
    case "stopRecording":
      return extractor.stop();
    case "isRecording":
      return Promise.resolve(extractor.running);
	}
}));

browser.browserAction.onClicked.addListener(() => {
  browser.sidebarAction.open();
});

for (const site of Object.values(sites)) {
  for (const [key, value] of Object.entries(site.extractors)) {
    extractor.addRule({
      site_id: site.id,
      extractor_id: key,
      ...value
    });
  }
}

browser.tabs.onRemoved.addListener((tabId) => {
  extractor.unwatchTab(tabId);
});

function notifyError(err) {
  console.error(err);
	browser.notifications.create({
		type: "basic",
		title: "Image Picka",
		message: err.message || String(err),
		iconUrl: "images/icon.svg"
	});
}

function closeTab({tabId, opener}) {
	if (opener) {
		browser.tabs.update(opener, {active: true});
	}
	browser.tabs.remove(tabId);
}
