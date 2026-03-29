import EventLite from 'event-lite';

class SiteMap extends Map {
  constructor() {
    super();
    this.ee = new EventLite();
  }
  update(newSites) {
    for (const [key, value] of newSites) {
      this.set(key, value);
    }
  }
}

export const sites = new SiteMap();

