import EventLite from 'event-lite';

export const sites = new SiteMap();

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
