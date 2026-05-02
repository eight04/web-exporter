import browser from "webextension-polyfill";
// FIXME: https://bugzilla.mozilla.org/show_bug.cgi?id=1998871
import {URLPattern} from "urlpattern-polyfill";
import Events from "event-lite";

import {sites} from "./sites.mjs";
import {stepExecutor} from "./step-executor.mjs";
import {logger} from "./logger.mjs";
import {_} from "./i18n.mjs";
import {Response} from "./response.js";

class Extractor extends Events {
  constructor() {
    super();
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
    if (details.method === "OPTIONS") {
      return;
    }
    const matches = [];
    for (const rule of this.rules) {
      const match = rule.url.exec(details.url);
      if (!match) {
        continue;
      }
      if (rule.type && rule.type !== details.type) {
        continue;
      }
      matches.push({rule, match});
    }
    if (!matches.length) {
      return;
    }
    logger.log(_("extractorMatched", [details.url, matches.map(m => m.rule.extractor_id).join(", ")]));

    const response = new Response(details);
    for (const {rule, match} of matches) {
      const ctx = {
        request: details,
        tabId: details.tabId,
        ...rule,
        match,
        response
      };
      this.emit(`${rule.site_id}::${rule.extractor_id}::start`);
      stepExecutor(ctx).catch(e => {
        logger.error(e);
      });
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
  clearRules() {
    this.rules = [];
  }
}

export const extractor = new Extractor;

sites.ee.on("reloaded", () => {
  extractor.clearRules();

  for (const site of sites.values()) {
    for (const [key, value] of Object.entries(site.extractors)) {
      extractor.addRule({
        site_id: site.id,
        extractor_id: key,
        ...value
      });
    }
  }
});
