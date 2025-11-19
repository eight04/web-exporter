// import webextMenus from "webext-menus";
import browser from "webextension-polyfill";

import {extractor} from "./lib/extrator.mjs";
import sites from "./sites/index.mjs";
import {deleteAllDatabases} from "./lib/store.mjs";
import {stepExecutor} from "./lib/step-executor.mjs";
import exporter from "./lib/exporter.mjs";

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
    case "deleteDatabase":
      return deleteAllDatabases();
    case "exportData":
      return exportData(message);
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

function notifyError(err) {
  console.error(err);
	browser.notifications.create({
		type: "basic",
		title: browser.runtime.getManifest().name,
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

async function exportData({type}) {
  for (const [site_id, site] of Object.entries(sites)) {
    for (const exporter of Object.values(site.exporters)) {
      if (exporter.type !== type) {
        continue;
      }
      const ctx = {...exporter, site_id, exporter_type: type};
      await stepExecutor(ctx);
    }
  }
  const length = exporter.getTasks().length;
  const text = exporter.output();
  exporter.clearTasks();
  return {text, length};
}
