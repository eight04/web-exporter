import {parse as pathParse} from "path-unified/posix";
import pyformat from "js-pyformat";

export default createDownloader();

function createDownloader() {
  const tasks = [];
  return {
    download: (urls, {default_ext, filename, ctx}) => {
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
        tasks.push({url: url.href, filename: finalName});
      }
    },
    getTasks: () => tasks.slice(),
    clearTasks: () => { tasks.length = 0; }
  };
}
