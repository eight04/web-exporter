import browser from "webextension-polyfill";

import {sites} from "./sites.mjs";
import {stepExecutor} from "./step-executor.mjs";
import {logger} from "./logger.mjs";

export const spiderHouse = init();

sites.ee.on("reloaded", () => {
  spiderHouse.stopAll().catch(console.error);
});

function init() {
  // TODO: cleanup closed tabs
  let runningSpiders = new Map(); // tabId -> ctx

  return {
    async start({tabId, site_id, id}) {
      if (runningSpiders.has(tabId)) {
        throw new Error(`Spider is already running on tab ${tabId}`);
      }
      if (!sites.has(site_id)) {
        throw new Error(`Site ${site_id} not found`);
      }
      if (!sites.get(site_id).spiders?.[id]) {
        throw new Error(`Spider ${id} not found for site ${site_id}`);
      }
      const spec = sites.get(site_id).spiders[id];
      const ctx = {
        ...spec,
        site_id,
        spider_id: id,
        tabId,
        abortController: new AbortController(),
        promise: null
      };
      logger.log(`Starting spider ${ctx.spider_id} on tab ${ctx.tabId}`);
      runningSpiders.set(ctx.tabId, ctx);
      browser.runtime.sendMessage({
        method: "spiderStatusChanged",
      });
      ctx.promise = stepExecutor(ctx);
      ctx.promise
        .finally(() => {
          runningSpiders.delete(ctx.tabId);
          browser.runtime.sendMessage({
            method: "spiderStatusChanged",
          });
        })
        .then(() => {
          logger.log(`Spider ${ctx.spider_id} on tab ${ctx.tabId} finished`);
        })
        .catch(err => {
          logger.error(err);
        });
    },
    async stop({tabId}) {
      const ctx = runningSpiders.get(tabId);
      if (!ctx) {
        throw new Error(`No spider is running on tab ${tabId}`);
      }
      ctx.abortController.abort();
      await ctx.promise;
    },
    async stopAll() {
      const stopPromises = [];
      for (const tabId of runningSpiders.keys()) {
        const p = this.stop({tabId}).catch(console.error);
        stopPromises.push(p);
      }
      await Promise.all(stopPromises);
    },
    isRunning(tabId) {
      return runningSpiders.has(tabId);
    },
    getSpiders() {
      const result = [];
      for (const site of sites.values()) {
        if (!site.spiders) continue;
        for (const key in site.spiders) {
          result.push({
            id: key,
            site_id: site.id,
            url: site.spiders[key].url
          });
        }
      }
      return result;
    }
  };
}


