import browser from "webextension-polyfill";
import * as RX from "linkify-plus-plus-core/lib/rx.js";
import {pEvent} from "p-event";
import pyformat from "js-pyformat";
import delay from "delay";

import {getStore} from "./store.mjs";
import {exporter} from "./exporter.mjs";
import {extractor} from "./extrator.mjs";
import {logger} from "./logger.mjs";
import {_} from "./i18n.mjs";
import * as jp from "./json-path.mjs";

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
  ...RX
};

const BUILTIN_CONDITIONS = {
  IS_IMAGE: it => RX.IMAGE.test(it),
  IS_URL: it => RX.URL.test(it),
  NOT_NULL: it => it !== null && it !== undefined,
  NOT_TRUE: it => !it,
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
      if (step.pattern in DEFAULT_RX) {
        step.re = DEFAULT_RX[step.pattern];
      } else {
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
    }
    if (step.all && !step.reAll) {
      if (!step.re.flags.includes("g")) {
        step.reAll = new RegExp(step.re.source, step.re.flags + "g");
      } else {
        step.reAll = step.re;
      }
    }
    let result;
    const formatTemplate = (template, match) => {
      if (!template) return match[0];
      return template.replace(/\$(\d+|\w+|&)/g, (m, p1) => {
        if (match.groups && p1 in match.groups) {
          return match.groups[p1];
        }
        if (p1 === "&") {
          return match[0];
        }
        return match[Number(p1)];
      });
    }
    if (step.all) {
      result = [];
      let match;
      step.reAll.lastIndex = 0;
      while ((match = step.reAll.exec(input)) !== null) {
        result.push(formatTemplate(step.template, match));
      }
      if (result.length === 0) {
        console.warn(`Pattern not matched: ${step.reAll.toString()}`);
      }
    } else {
      const match = step.re.exec(input);
      if (!match) {
        throw new Error(`Pattern not matched: ${step.re.toString()}`);
      }
      result = formatTemplate(step.template, match);
    }
    return result
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
    return jp.get(input, step.path);
  },
  store: async (ctx, step, input) => {
    const store = getStore(ctx.site_id)
    return await store[step.method]({
      extractor_id: ctx.extractor_id,
      value: input,
      ...step
    });
  },
  table_join: async (ctx, step, input) => {
    const store = getStore(ctx.site_id);
    const tableData = await store.getAll({table: step.table});
    const map = new Map;
    for (const row of tableData) {
      map.set(jp.get(row, step.right_key), row);
    }
    const result = [];
    for (const row of input) {
      const rightRow = map.get(jp.get(row, step.left_key));
      if (rightRow) {
        const o = {...row};
        for (const key in step.fields) {
          const rightField = step.fields[key];
          jp.set(o, key, jp.get(rightRow, rightField));
        }
        result.push(o);
      } else {
        logger.log(_("joinTableIndexError", [step.table, step.right_key, row[step.left_key]]));
      }
    }
    return result;
  },
  for_each: async (ctx, step, input, model) => {
    const result = [];
    if (!step.test_fn && step.condition) {
      step.test_fn = compileCondition(step.condition);
    }
    for (const item of input) {
      if (step.test_fn && !step.test_fn(item)) {
        continue;
      }
      let subModel;
      if (step.ref) {
        subModel = model;
        jp.set(subModel, step.ref, item);
        if (typeof item === "object") {
          item.index = result.length;
        }
      } else {
        subModel = item;
      }
      const value = await stepExecutor({...ctx, steps: step.steps}, subModel);
      result.push(value);
    }
    return result;
  },
  date: (ctx, step, input) => {
    const date = new Date(input);
    return date;
  },
  filter: (ctx, step, input) => {
    if (!step.test_fn) {
      step.test_fn = compileCondition(step.condition);
    }
    const result = input.filter(item => {
      return step.test_fn(item);
    });
    return result;
  },
  export: async (ctx, step, input, model) => {
    if (!Array.isArray(input)) {
      input = [input];
    }
    return await exporter.export({
      ...step,
      input,
      type: ctx.exporter_type,
      ctx: model
    })
  },
  find: (ctx, step, input) => {
    let result = null;
    let value;
    const cmp = (a, b) => {
      if (step.mode === "min") {
        return a < b;
      } else {
        return a > b;
      }
    }
    for (const item of input) {
      const newValue = jp.get(item, step.key);
      if (value === undefined || cmp(newValue, value)) {
        value = newValue;
        result = item;
      }
    }
    if (!result) {
      throw new Error(`No item found for find ${step.mode}`);
    }
    return result;
  },
  if: async (ctx, step, input) => {
    if (!step.test_fn) {
      step.test_fn = compileCondition(step.condition);
    }
    ctx.test_result = step.test_fn(input);
    if (ctx.test_result) {
      return await stepExecutor({...ctx, steps: step.steps}, input);
    }
  },
  elif: async (ctx, step, input) => {
    if (ctx.test_result) {
      return;
    }
    if (!step.test_fn) {
      step.test_fn = compileCondition(step.condition);
    }
    ctx.test_result = step.test_fn(input);
    if (ctx.test_result) {
      return await stepExecutor({...ctx, steps: step.steps}, input);
    }
  },
  else: async (ctx, step, input) => {
    if (ctx.test_result) {
      return;
    }
    return await stepExecutor({...ctx, steps: step.steps}, input);
  },
  flat: (ctx, step, input) => {
    return input.flat(step.depth ?? Infinity);
  },
  debug: (ctx, step, input) => {
    console.log("DEBUG:", ctx, step, input);
    logger.log(pyformat(step.message || "DEBUG: {0}", input));
  },
  const: (ctx, step) => {
    return step.value;
  },
  spider_refresh: async (ctx, step, input) => {
    if (step.url) {
      let u = pyformat(step.url, {...ctx, ...input});
      const {url: baseUrl} = await browser.tabs.get(ctx.tabId);
      u = new URL(u, baseUrl).toString();
      logger.log(`spider_refresh: navigating to ${u}`);
      await browser.tabs.update(ctx.tabId, {url: u});
    } else {
      logger.log(`spider_refresh: reloading tab`);
      await browser.tabs.reload(ctx.tabId);
    }
  },
  spider_click: async (ctx, step) => {
    let success = false;
    try {
      success = await browser.tabs.sendMessage(ctx.tabId, {
        method: "spiderClick",
        selector: step.selector
      });
      logger.log(`spider_click: ${success ? "success" : "failed"}`);
    } catch (err) {
      console.error("spider_click error:", err);
    } finally {
      ctx.test_result = success;
    }
  },
  wait: async (ctx, step) => {
    const ps = [];
    if (step.extractor) {
      const hash = `${ctx.site_id}::${step.extractor}::start`;
      ps.push(pEvent(extractor, hash, {timeout: step.timeout || 30000, signal: ctx.abortController?.signal}));
    }
    if (step.seconds) {
      ps.push(delay(step.seconds * 1000, {signal: ctx.abortController?.signal}));
    }
    if (!ps.length) {
      throw new Error("wait step requires extractor or seconds");
    }
    await Promise.all(ps);
  },
  loop: async (ctx, step, input) => {
    let aborted = false;
    while (!aborted) {
      await stepExecutor(
        {
          ...ctx,
          steps: step.steps,
          breakLoop: () => aborted = true
        },
        input,
        () => aborted
      );
    }
  },
  loop_break: (ctx) => {
    ctx.breakLoop();
  },
  object_values: (ctx, step, input) => {
    if (!input) return [];
    return Object.values(input);
  }
}

export async function stepExecutor(ctx, model = null, shouldBreak = null) {
  for (const step of ctx.steps) {
    ctx.abortController?.signal.throwIfAborted();
    let input;
    if ("input" in step) {
      input = jp.get(model, step.input);
    } else {
      input = model;
    }
    const output = await STEPPER[step.use](ctx, step, input, model);
    if (output) {
      if ("output" in step) {
        let [, m, outputPath] = step.output.match(/^(\+)?(.*)$/);
        if (!m) {
          jp.set(model, outputPath, output);
        } else {
          let oldValue = jp.get(model, outputPath, []);
          jp.set(model, outputPath, oldValue.concat(output));
        }
      } else {
        model = output;
      }
    }
    if (shouldBreak && shouldBreak()) {
      break;
    }
  }
  return model;
}

function compileConditionObj(conditionObj) {
  const compiled = {};
  for (const key in conditionObj) {
    compiled[key] = compileCondition(conditionObj[key]);
  }
  return (it) => {
    for (const key in compiled) {
      if (!compiled[key](jp.get(it, key))) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Compile a condition which can be a string or an object
 * @param {string|object} condition 
 * @returns {function} A function that takes an input and returns a boolean
 */
function compileCondition(condition) {
  if (typeof condition === "string") {
    return compileConditionStr(condition);
  }
  if (Array.isArray(condition)) {
    throw new Error("Array condition is not supported");
  }
  return compileConditionObj(condition);
}

function compileConditionStr(conditionStr) {
  if (conditionStr in BUILTIN_CONDITIONS) {
    const fn = BUILTIN_CONDITIONS[conditionStr];
    return fn;
  }
  const re = new RegExp(conditionStr);
  return (it) => re.test(it);
}
