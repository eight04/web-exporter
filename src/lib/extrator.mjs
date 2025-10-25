import browser from "webextension-polyfill";

import {stepExecutor} from "./step-executor.mjs";

export const extractor = new Extractor;

class Extractor {
  constructor() {
    this.watchingTabs = new Set();
    this.rules = [];

    this.onBeforeRequest = this.onBeforeRequest.bind(this);
  }
  watchTab(tabId) {
    if (!this.watchingTabs.size) {
      this.addListener();
    }
    this.watchingTabs.add(tabId);
  }
  unwatchTab(tabId) {
    this.watchingTabs.delete(tabId);
    if (!this.watchingTabs.size) {
      this.removeListener();
    }
  }
  onBeforeRequest(details) {
    if (!this.watchingTabs.has(details.tabId)) {
      return;
    }
    const matches = [];
    for (const rule of this.rules) {
      const match = rule.url.exec(details.url);
      if (match) {
        matches.push({rule, match});
      }
    }
    if (!matches.length) {
      return;
    }

    const filter = browser.webRequest.filterResponseData(details.requestId);
    const chunks = [];

    filter.ondata = event => {
      chunks.push(event.data);
      filter.write(event.data);
    }
    filter.onstop = async () => {
      filter.disconnect();
      const ctx = {
        byteChunks: chunks,
        request: details,
      };
      for (const {rule, match} of matches) {
        Object.assign(ctx, {...rule, match});
        await stepExecutor(ctx);
      }
    }
  }
  removeListener() {
    browser.webRequest.onBeforeRequest.removeListener(this.onBeforeRequest);
  }
  addListener() {
    // FIXME: should we add event listener for each tab?
    browser.webRequest.onBeforeRequest.addListener(
      this.onBeforeRequest,
      {
        urls: ["<all_urls>"],
        types: ["main_frame", "sub_frame", "xmlhttprequest"]
      },
      ["blocking"]
    );
  }
  /**
   * @param {Object} rule
   * @param {string} rule.site_id
   * @param {string} rule.extractor_id
   * @param {string} rule.url - URLPattern string
   * @param {Array} rule.steps - extraction steps
   */
  addRule(rule) {
    rule.url = new URLPattern(rule.url);
    this.rules.push(rule);
  }
}
