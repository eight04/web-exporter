// import webextMenus from "webext-menus";
import browser from "webextension-polyfill";
import * as YAML from "yaml";

import {sites} from "./lib/sites.mjs";
import {extractor} from "./lib/extractor.mjs";
import {deleteAllDatabases} from "./lib/store.mjs";
import {stepExecutor} from "./lib/step-executor.mjs";
import {exporter} from "./lib/exporter.mjs";
import {spiderHouse} from "./lib/spider-house.mjs";
import {mutex} from "./lib/mutex.mjs";

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
    case "startSpider":
      return spiderHouse.start(message);
    case "stopSpider":
      return spiderHouse.stop(message);
    case "isSpiderRunning":
      return Promise.resolve(spiderHouse.isRunning(message.tabId));
    case "configUpdated":
      return reloadConfig();
    case "getSpiders":
      return Promise.resolve(spiderHouse.getSpiders());
	}
}));

browser.browserAction.onClicked.addListener(() => {
  browser.sidebarAction.open();
});

reloadConfig();

const reloadConfig = mutex(async function () {
  const newSites = new Map();

  let r;
  r = await browser.storage.local.get("configIds");
  const configIds = r.configIds || [];

  if (configIds.length > 0) {
    r = await browser.storage.local.get(configIds.map(id => `config/${id}`));
    for (const key in r) {
      const text = r[key];
      const site = YAML.parse(text);
      newSites.set(site.id, site);
    }
  }

  r = await fetch(browser.runtime.getURL("sites/index.txt"));
  const text = await r.text();
  const defaultConfigIds = text.split("\n").map(line => line.trim()).filter(line => line);
  for (const id of defaultConfigIds) {
    if (newSites.has(id)) {
      continue;
    }
    const r = await fetch(browser.runtime.getURL(`sites/${id}.yml`));
    const text = await r.text();
    const site = YAML.parse(text);
    newSites.set(site.id, site);
  }

  sites.clear();
  sites.update(newSites);
  sites.ee.emit("reloaded");

}, {maxPending: 2});

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
    if (!site.exporters) {
      continue;
    }
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

