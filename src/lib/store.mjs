import Dexie from "dexie/dist/modern/dexie.mjs";

import sites from "../sites/index.mjs";

const CONNECTED_STORES = {};

class Store {
  constructor(site_id) {
    this.db = new Dexie(`web_exporter/sites/${site_id}`);
    const site = sites[site_id];
    const lastDb = site.db[site.db.length - 1];
    this.db.version(lastDb.version).stores(lastDb.schema);
  }
  async put({extractor_id, key, value}) {
    value.extractor_id = extractor_id;
    await this.db[key].put(value);
  }
  async putMany({extractor_id, key, value}) {
    value.forEach(v => {
      v.extractor_id = extractor_id;
    });
    await this.db[key].bulkPut(value);
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
