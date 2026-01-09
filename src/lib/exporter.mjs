import browser from "webextension-polyfill";

import {parse as pathParse} from "path-unified/posix";
import pyformat from "js-pyformat";

export const exporter = init();

function init() {
  const tasks = [];
  return {
    export: ({type, ...rest}) => {
      if (type === "media") {
        return exportMedia(rest);
      }
      if (type === "url") {
        return exportUrl(rest);
      }
      if (type === "download") {
        return download(rest);
      }
    },
    getTasks: () => tasks.slice(),
    clearTasks: () => { tasks.length = 0; },
    output: () => {
      let text = "";
      for (const t of tasks) {
        if (t.filename) {
          text += `${t.url}#out=${t.filename}\n`;
        } else {
          text += `${t.url}\n`;
        }
      }
      return text;
    }
  };

  function exportUrl({input: urls}) {
    tasks.push(...urls.map(url => ({url})));
  }

  function exportMedia({input: urls, default_ext, filename, ctx}) {
    const files = renderFilename({urls, filename, ctx, default_ext});
    tasks.push(...files);
  }

  function renderFilename({urls, filename, ctx, default_ext}) {
    const files = [];
    ctx = {...ctx};
    for (let i = 0; i < urls.length; i++) {
      const url = new URL(urls[i]);
      ctx.index = i;
      const fileInfo = pathParse(url.pathname);
      if (!ctx.filebase) {
        ctx.filebase = fileInfo.base;
      }
      if (!ctx.filename) {
        ctx.filename = fileInfo.name;
      }
      if (!ctx.ext) {
        ctx.ext = fileInfo.ext || default_ext || ".jpg";
      }
      if (ctx.ext.includes(":")) {
        // Handle cases like ".jpg:large"
        ctx.ext = ctx.ext.split(":")[0];
      }
      const finalName = pyformat(filename, ctx);
      files.push({url: url.href, filename: finalName});
    }
    return files;
  }

  async function download({input: urls, filename, ctx, executorCtx, default_ext}) {
    const files = renderFilename({urls, filename, ctx, default_ext});
    for (const file of files) {
      // FIXME: download init error will throw the entire extractor process. Should we catch and let the extractor continue?
      await browser.downloads.download({
        url: file.url,
        filename: file.filename,
        conflictAction: "uniquify",
        saveAs: false,
        cookieStoreId: executorCtx?.request?.cookieStoreId,
        headers: [
          {
            name: "Referer",
            value: executorCtx?.request?.url || ""
          }
        ]
      });
    }
  }
}
