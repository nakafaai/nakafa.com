import type { Rolldown, UserConfig } from "vite";
import { workerSettings } from "#www/worker";

/*
 * How each environment of the build writes its output: the files the browser's
 * JavaScript is cut into, and the source maps of the Worker.
 *
 * Google renders a page in a browser that loads about 250 of its resources and
 * fails every later one with "Other error". A module graph that misses one
 * module never runs, so a page that needs more files than that never starts for
 * Google. The Search Console live test, the Rich Results Test and AdSense's site
 * review all render this way: on 13 November 2026, 249 of 300 independent modules
 * loaded there, every page booted 246 to 399 scripts, and AdSense read the site
 * as down. Rolldown gives every set of entries that shares modules a chunk of its
 * own, and the browser build has 731 entries, its lazy routes and the modules it
 * imports on intent. 187 of the 217 files every page booted with were under 5 KB.
 * `BOOT_SCRIPT_LIMIT` in `src/lib/static/scripts.ts` fails a build whose page
 * boots too many.
 */

/**
 * The most bytes, as Rolldown transformed them, of a shared chunk that Rolldown
 * copies into each chunk that uses it rather than writing it as a file.
 */
const INLINE_CHUNK_BYTES = 16 * 1024;

/** A stylesheet: Vite extracts each chunk's styles, so no chunk copies one. */
const STYLESHEET =
  /\.(?:css|scss|sass|less|styl|stylus|pcss|postcss|sss)(?:\?|$)/u;

/**
 * The code splitting of the browser's JavaScript.
 *
 * The boot chunk holds the modules that the browser entry imports statically.
 * Every page runs all of them when it boots, so one file replaces the 100 to 200
 * that every page loaded first.
 *
 * Rolldown copies each shared chunk under `INLINE_CHUNK_BYTES` into the chunks
 * that use it, and its shared runtime runs each copied module once, so every
 * copy shares one module state. Copies need `strictExecutionOrder`, which runs
 * every module in its source order wherever it lands. Measured on the 795
 * prerendered pages on 13 November 2026: a page boots 14 to 36 scripts and loads
 * 16 to 73 in all, its first JavaScript is 3 to 9% smaller than before, and the
 * build's JavaScript grows from 27 to 32 MB. A limit of 48 KB booted the same
 * bytes in 10 to 23 scripts but wrote 39 MB, more of it fetched again on every
 * navigation. Cutting the small modules by hand failed: `ModuleInfo` reports the
 * import graph before Rolldown resolves re-export barrels, so the cut pulled
 * route code into every page.
 */
const BROWSER_CODE_SPLITTING = {
  experimentalInlineCommonChunks: {
    exclude: STYLESHEET,
    maxSize: INLINE_CHUNK_BYTES,
  },
  groups: [{ name: "boot", priority: 1, tags: ["$initial"] }],
} satisfies Rolldown.CodeSplittingOptions;

/** The output of each environment, by its Vite environment name. */
export const ENVIRONMENT_OUTPUTS = {
  client: {
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: BROWSER_CODE_SPLITTING,
          strictExecutionOrder: true,
        },
      },
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
