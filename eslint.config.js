import js from "@eslint/js";
import globals from "globals";

// The extension's files are plain scripts (no bundler, no imports). Content
// scripts share one global scope per frame, so the shared objects below are
// globals defined by src/shared/settings.js and src/youtube/core.js.
const shared = {
  DumbTubeSettings: "readonly",
  DumbTube: "readonly",
};

export default [
  { ignores: ["node_modules/", "test-results/"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: { ...globals.browser, ...globals.webextensions, ...shared },
    },
  },
  {
    // The service worker loads settings.js with importScripts.
    files: ["src/background.js"],
    languageOptions: { globals: { ...globals.serviceworker, ...globals.webextensions, ...shared } },
  },
  {
    files: ["tests/**/*.mjs", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      // Test code also runs functions inside the page and the service worker,
      // including the worker's own top-level functions.
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.webextensions,
        ...shared,
        togglePause: "readonly",
        toggleFocusTimer: "readonly",
        moveSettingsToSync: "readonly",
      },
    },
  },
  {
    rules: {
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
