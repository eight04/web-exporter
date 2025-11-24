import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["dist-extension/*", "build", "chrome"]
  },
  js.configs.recommended,
  {
    "rules": {
      "dot-notation": 2,
      "max-statements-per-line": 2,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        // ...globals.webextensions,
      }
    },
  },
  {
    files: ["test/**/*.js", "*.{js,mjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
      }
    }
  },
  {
    files: ["**/*.svelte.js"],
    languageOptions: {
      globals: {
        // Svelte specific globals
        $state: "readonly",
        $derived: "readonly",
        $effect: "readonly",
      }
    }
  }
];
