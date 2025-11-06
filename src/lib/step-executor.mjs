import {getStore} from "./store.mjs";
import logger from "./logger.mjs";

const RESPONSE_TYPE = {
  text: (ctx) => {
    const decoder = new TextDecoder("utf-8");
    let result = "";
    for (const chunk of ctx.byteChunks) {
      result += decoder.decode(chunk, {stream: true});
    }
    result += decoder.decode();
    ctx.response.text = result;
  },
  json: (ctx) => {
    if (!ctx.response.text) {
      RESPONSE_TYPE.text(ctx);
    }
    ctx.response.json = JSON.parse(ctx.response.text);
  }
}

const DEFAULT_RX = {
  RX_MEDIA_URL: /https?:\/\/[^\s"'<>]+?\.(?:mp4|webm|ogg|mp3|wav|flac|m4a|)(?:\?[^\s"'<>]*)?/gi,
}

const STEPPER = {
  response: async (ctx, step) => {
    if (!ctx.response) {
      ctx.response = {};
    }
    if (!ctx.response[step.type]) {
      await RESPONSE_TYPE[step.type](ctx)
    }
    return ctx.response[step.type];
  },
  re: (ctx, step, input) => {
    if (!step.re) {
      if (!step.match) {
        if (step.pattern[0] === "/") {
          const lastSlash = step.pattern.lastIndexOf("/");
          step.match = step.pattern.slice(1, lastSlash);
          step.flags = step.pattern.slice(lastSlash + 1);
        } else {
          step.match = step.pattern;
        }
      }
      step.re = new RegExp(step.match, step.flags || "");
    }
    const result = step.re.exec(input);
    if (!result) {
      throw new Error(`Pattern not matched: ${step.re.toString()}`);
    }
    if (step.ret) {
      // Return a specific capture group
      // ret can be $1 or $name
      const key = step.ret.slice(1);
      if (result.groups && key in result.groups) {
        return result.groups[key];
      }
      return result[Number(key)];
    }
    return result[0]
  },
  json_parse: (ctx, step, input) => {
    if (step.unwrap_new_date) {
      input = input.replace(/new Date\(([^)]+)\)/g, (match, p1) => {
        return p1;
      });
    }
    const obj = JSON.parse(input);
    return obj;
  },
  json_get: (ctx, step, input) => {
    const path = step.path.split(".");
    let current = input;
    for (const key of path) {
      if (!(key in current)) {
        throw new Error(`Key not found in JSON object: ${key}`);
      }
      current = current[key];
    }
    return current;
  },
  store: async (ctx, step, input) => {
    const store = getStore(ctx.site_id)
    await store[step.method]({
      extractor_id: ctx.extractor_id,
      key: step.key,
      value: input
    });
  },
  table_join: async (ctx, step, input) => {
    const store = getStore(ctx.site_id);
    const tableData = await store.getAll({key: step.table});
    const map = new Map;
    for (const row of tableData) {
      map.set(row[step.right_key], row);
    }
    const result = [];
    for (const row of input) {
      const rightRow = map.get(row[step.left_key]);
      if (rightRow) {
        const o = {...row};
        for (const key in step.fields) {
          const rightField = step.fields[key];
          o[key] = rightRow[rightField];
        }
        result.push(o);
      } else {
        logger.log(`No matching row found in table '${step.table}' for key '${row[step.left_key]}'`);
      }
    }
    return result;
  },
  for_each: async (ctx, step, input) => {
    const result = [];
    for (const item of input) {
      const value = await stepExecutor({...ctx, steps: step.steps}, item);
      result.push(value);
    }
    return result;
  },
  date: (ctx, step, input) => {
    const date = new Date(input);
    return date;
  }
}

export async function stepExecutor(ctx, model = null) {
  for (const step of ctx.steps) {
    let input;
    if ("input" in step) {
      input = model[step.input];
    } else {
      input = model;
    }
    const output = await STEPPER[step.use](ctx, step, input);
    if ("output" in step) {
      model[step.output] = output;
    } else {
      model = output;
    }
  }
  return model;
}
