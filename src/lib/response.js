import browser from 'webextension-polyfill';

export class Response {
  constructor({url, requestId}) {
    this.url = url;
    this.requestId = requestId;
    this.filter = null;
    this.filterFinished = null;
    this.chunks = [];
    this._text = null;
    this._json = undefined;
  }
  prepare() {
    if (this.filterFinished) {
      return this.filterFinished;
    }
    this.filterFinished = new Promise((resolve, reject) => {
      this.filter = browser.webRequest.filterResponseData(this.requestId);

      this.filter.ondata = event => {
        this.chunks.push(event.data);
        this.filter.write(event.data);
      }

      this.filter.onstop = async () => {
        this.filter.disconnect();
        resolve(this.chunks);
      }
      this.filter.onerror = event => {
        // FIXME: https://bugzilla.mozilla.org/show_bug.cgi?id=2036435
        reject(new Error(`Error in filter for ${this.url}: ${this.filter.error}`));
        console.error(event);
      }
    });
    return this.filterFinished;
  }
  async text() {
    if (this._text !== null) {
      return this._text;
    }
    const chunks = await this.prepare();
    const decoder = new TextDecoder("utf-8");
    let result = "";
    for (const chunk of chunks) {
      result += decoder.decode(chunk, {stream: true});
    }
    result += decoder.decode();
    this._text = result;
    return this._text;
  }
  async json() {
    if (this._json !== undefined) {
      return this._json;
    }
    const text = await this.text();
    try {
      this._json = JSON.parse(text);
    } catch (err) {
      console.error(`Error parsing JSON from ${this.url}: ${err.message}`);
      throw err;
    }
    return this._json;
  }
}
