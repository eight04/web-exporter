// import * as path from "path";

import cjs from "rollup-plugin-cjs-es";
import resolve from "@rollup/plugin-node-resolve";
import {copy} from '@web/rollup-plugin-copy';
import iife from "rollup-plugin-iife";
import terser from "@rollup/plugin-terser";
import output from "rollup-plugin-write-output";
import json from "@rollup/plugin-json";
import yaml from "@rollup/plugin-yaml";
import svelte from "rollup-plugin-svelte";

import glob from "tiny-glob";

const input = await glob("src/*.js");

export default async () => ({
  input,
  output: {
    format: "es",
    dir: "build",
    sourcemap: true
  },
  plugins: [
    resolve({
      exportConditions: [
        'browser', 'node'
      ]
    }),
    svelte({
      include: "src/**/*.svelte",
      emitCss: false
    }),
    json(),
    yaml(),
    cjs({
      nested: true
    }),
    copy({
      patterns: "**/*",
      rootDir: "src/static"
    }),
    iife(),
    !process.env.ROLLUP_WATCH && terser({
      module: false
    }),
    output([
      {
        test: /background\.js$/,
        target: "build/manifest.json",
        handle: (json, {scripts}) => {
          json.background.scripts = scripts;
          return json;
        }
      },
      {
        test: /content\.js$/,
        target: "build/manifest.json",
        handle: (json, {scripts}) => {
          json.content_scripts[0].js = scripts;
          return json;
        }
      },
      {
        test: /(sidebar)\.js$/,
        target: "build/$1.html",
        handle: (content, {htmlScripts}) => {
          return content.replace("</body>", `${htmlScripts}\n</body>`);
        }
      }
    ])
  ]
});
