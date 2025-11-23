import browser from "webextension-polyfill";

import sites from "../sites/index.mjs";

import {stepExecutor} from "./step-executor.mjs";
import {logger} from "./logger.mjs";

export const spiderHouse = init();

function init() {
  let runningSpiders = new Map(); // tabId -> ctx

  return {
    async start({tabId, site_id, id}) {
      if (runningSpiders.has(tabId)) {
        throw new Error(`Spider is already running on tab ${tabId}`);
      }
      const spec = sites[site_id].spiders[id];
      const ctx = {
        ...spec,
        site_id,
        spider_id: id,
        tabId,
        abortController: new AbortController(),
        promise: null
      };
      logger.log(`Starting spider ${ctx.spider_id} on tab ${ctx.tabId}`);
      ctx.promise = startSpider(ctx)
        .then(() => {
          logger.log(`Spider ${ctx.spider_id} on tab ${ctx.tabId} finished`);
        })
        .catch(err => {
          logger.error(err);
        });
    },
    async stop({tabId}) {
      const spider = runningSpiders.get(tabId);
      if (!spider) {
        throw new Error(`No spider is running on tab ${tabId}`);
      }
      spider.abortController.abort();
      await spider.promise;
    },
    isRunning(tabId) {
      return runningSpiders.has(tabId);
    }
  };

  async function startSpider(ctx) {
    runningSpiders.set(ctx.tabId, ctx);
    browser.runtime.sendMessage({
      method: "spiderStatusChanged",
    });
    try {
      await stepExecutor( ctx );
    } finally {
      runningSpiders.delete(ctx.tabId);
      browser.runtime.sendMessage({
        method: "spiderStatusChanged",
      });
    }
  }
}


