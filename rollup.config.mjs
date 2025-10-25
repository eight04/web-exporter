import cjs from "rollup-plugin-cjs-es";
import resolve from "@rollup/plugin-node-resolve";
import {copy} from '@web/rollup-plugin-copy';
import iife from "rollup-plugin-iife";
import terser from "@rollup/plugin-terser";
import output from "rollup-plugin-write-output";
import json from "@rollup/plugin-json";
import yaml from "@rollup/plugin-yaml";

import glob from "tiny-glob";

export default async () => ({
  input: await glob("src/*.js"),
  output: {
    format: "es",
    dir: "build",
    sourcemap: true
  },
  plugins: [
    resolve({
      // exportConditions: [
      //   'node'
      // ]
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
    terser({
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
        test: /(\w+)\.js$/,
        target: "build/$1.html",
        handle: (content, {htmlScripts}) => {
          return content.replace("</body>", `${htmlScripts}\n</body>`);
        }
      }
    ])
  ]
});
