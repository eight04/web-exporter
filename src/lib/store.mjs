import Dexie from "dexie/dist/modern/dexie.mjs";

import sites from "../sites/index.mjs";
import logger from "./logger.mjs";

const CONNECTED_STORES = {};

class Store {
  constructor(site_id) {
    this.db = new Dexie(`web_exporter/sites/${site_id}`);
    const site = sites[site_id];
    const lastDb = site.db[site.db.length - 1];
    this.db.version(lastDb.version).stores(lastDb.schema);
    this.site = site;
  }
  async put({extractor_id, key, value}) {
    const primKey = this.db[key].schema.primKey.name; // TODO: this won't work with compound primary key
    const mid = logger.log(`Storing item to ${key} (ID: ${value[primKey]})...`);

    value.extractor_id = extractor_id;
    try {
      await this.db[key].add(value);
      logger.extend(mid, `Done.`);
    } catch (e) {
      logger.log(`Add item to ${key} failed: ${e.message}`);
    }
  }
  async putMany({extractor_id, key, value}) {
    const primKey = this.db[key].schema.primKey.name; // TODO: this won't work with compound primary key
    const addedIds = value.map(v => {
      return v[primKey];
    });
    const mid = logger.log(`Storing ${value.length} items to ${key} (IDs: ${addedIds.join(", ")})...`);
    value.forEach(v => {
      v.extractor_id = extractor_id;
    });
    // https://dexie.org/docs/DexieErrors/Dexie.BulkError
    try {
      await this.db[key].bulkAdd(value);
      logger.extend(mid, `Done.`);
    } catch (e) {
      if (e.name === "BulkError") {
        e.failures.forEach(failure => {
          logger.log(`Bulk add failed: ${failure.message}`);
        });
      } else {
        throw e;
      }
    }
  }
}

export function getStore(site_id) {
  if (!(site_id in CONNECTED_STORES)) {
    const store = new Store(site_id);
    CONNECTED_STORES[site_id] = store;
  }
  return CONNECTED_STORES[site_id];
}

export function disconnectAllStores() {
  for (const [key, store] of Object.entries(CONNECTED_STORES)) {
    store.db.close();
    delete CONNECTED_STORES[key];
  }
}
