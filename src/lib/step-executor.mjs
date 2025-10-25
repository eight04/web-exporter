import {getStore} from "./store.mjs";

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
  }
}

export async function stepExecutor(ctx, value = null) {
  for (const step of ctx.steps) {
    value = await STEPPER[step.use](ctx, step, value);
  }
  return value;
}
