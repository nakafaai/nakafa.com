import type { Rolldown, UserConfig } from "vite";
import { workerSettings } from "#www/worker";

/*
 * How each environment of the build writes its output: the files the browser's
 * JavaScript is cut into, and the source maps of the Worker.
 */

/**
 * The code splitting of the browser's JavaScript.
 *
 * Google renders a page in a browser that loads about 250 of its resources and
 * fails every later one with "Other error". A module graph that misses one
 * module never runs, so a page that boots more files than that never starts for
 * Google. The Search Console live test, the Rich Results Test and AdSense's site
 * review all render this way: on 13 November 2026, 249 of 300 independent modules
 * loaded there, and AdSense read the site as down.
 *
 * Rolldown puts every module that the entry shares with a dynamic import, a
 * client reference or a lazy route, in a common chunk of its own. The code that
 * every page boots with came out as 217 files, 187 of them under 5 KB, and a page
 * booted 246 to 399. The modules that the browser entry imports statically form
 * one chunk here, in the order a single-entry bundle runs them. Every page loads
 * all of them already, so no page loads a byte more.
 */
const BROWSER_CODE_SPLITTING = {
  groups: [{ name: "boot", tags: ["$initial"] }],
} satisfies Rolldown.CodeSplittingOptions;

/** The output of each environment, by its Vite environment name. */
export const ENVIRONMENT_OUTPUTS = {
  client: {
    build: {
      rolldownOptions: { output: { codeSplitting: BROWSER_CODE_SPLITTING } },
    },
  },
  // Workers Logs maps stack traces without the embedded sources, and the
  // upload refuses more than 60 MiB of maps: the sources were 47 of 65 MiB.
  [workerSettings.viteEnvironments.entry]: {
    build: {
      rolldownOptions: { output: { sourcemapExcludeSources: true } },
    },
  },
} satisfies UserConfig["environments"];
