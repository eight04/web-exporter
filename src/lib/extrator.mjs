import browser from "webextension-polyfill";

import {stepExecutor} from "./step-executor.mjs";
import logger from "./logger.mjs";
import {_} from "./i18n.mjs";

export const extractor = new Extractor;

class Extractor {
  constructor() {
    this.running = false;
    this.rules = [];

    this.onBeforeRequest = this.onBeforeRequest.bind(this);
  }
  start() {
    if (!this.running) {
      this.running = true;
      this.addListener();
      logger.log(_("extractorStarted"));
    }
  }
  stop() {
    if (this.running) {
      this.running = false;
      this.removeListener();
      logger.log(_("extractorStopped"));
    }
  }
  onBeforeRequest(details) {
    if (!this.running) {
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
    // how to implement the UI?
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
