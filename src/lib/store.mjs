import Dexie from "dexie/dist/modern/dexie.mjs";

import sites from "../sites/index.mjs";
import logger from "./logger.mjs";
import {_} from "./i18n.mjs";

const CONNECTED_STORES = {};

class Store {
  constructor(site_id) {
    this.db = new Dexie(`web_exporter/sites/${site_id}`);
    const site = sites[site_id];
    const lastDb = site.db[site.db.length - 1];
    this.db.version(lastDb.version).stores(lastDb.schema);
    this.site = site;
  }
  async put({extractor_id, table, value}) {
    return await this.putMany({extractor_id, table, value: [value]});
  }
  async putMany({extractor_id, table, value}) {
    logger.log(_("storePutMany", [value.length, table]));
    value.forEach(v => {
      v.extractor_id = extractor_id;
    });
    // https://dexie.org/docs/DexieErrors/Dexie.BulkError
    try {
      await this.db[table].bulkAdd(value);
      logger.log(_("storePutManySuccess"));
    } catch (e) {
      if (e.name === "BulkError") {
        logger.log(_("storePutManyPartial", [e.failures.length]));
      } else {
        throw e;
      }
    }
  }
  async getAll({table}) {
    const items = await this.db[table].toArray();
    return items;
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

export async function deleteAllDatabases() {
  // FIXME: I can still see the database after Dexie.delete() is called? Though the data is gone.
  await disconnectAllStores();
  const siteIds = Object.keys(sites);
  for (const siteId of siteIds) {
    logger.log(_("storeDeleteDB", [siteId]));
    await Dexie.delete(`web_exporter/sites/${siteId}`);
    logger.log(_("storeDeleteDBSuccess"));
  }
}
