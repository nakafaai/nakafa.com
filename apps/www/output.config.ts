import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

/** The client loaders of the lesson renderer, which load each visual of the catalog lazily. */
const RENDERER_CLIENT = join(
  import.meta.dirname,
  "src/lib/content/renderer/client"
);

/** What a lazy renderer of the catalog imports: one design-system module, by its path. */
const LAZY_RENDERER =
  /import\(\s*"@repo\/design-system\/(?<module>components\/[^"]+)"\s*\)/gu;

/** A design-system module as a chunk's facade names it: its path, without its extension. */
const DESIGN_SYSTEM_MODULE =
  /\/packages\/design-system\/(?<module>components\/.+)\.tsx?$/u;

/**
 * The design-system module of every lazy renderer of the Visual Catalog, such as
 * `components/contents/biology/virus/structure`, read from the client loaders that import them.
 */
export function lazyRendererModules(): readonly string[] {
  const files = readdirSync(RENDERER_CLIENT, {
    recursive: true,
    encoding: "utf8",
  });
  const modules = new Set<string>();
  for (const file of files) {
    if (!file.endsWith(".tsx")) {
      continue;
    }
    const source = readFileSync(join(RENDERER_CLIENT, file), "utf8");
    for (const match of source.matchAll(LAZY_RENDERER)) {
      if (match.groups?.module !== undefined) {
        modules.add(match.groups.module);
      }
    }
  }
  return [...modules];
}

/**
 * The name of a lazy renderer's chunk: its module's path under `components`, so every visual of the
 * catalog has a chunk no other module shares, such as `catalog-contents-biology-virus-structure`.
 */
export function rendererChunkName(module: string) {
  return `catalog-${module.replace("components/", "").replaceAll("/", "-")}`;
}

/** The lazy renderer a chunk holds under its own name, read from the modules it was built from. */
function rendererOf(
  chunk: Rolldown.PreRenderedChunk,
  renderers: ReadonlySet<string>
) {
  for (const id of chunk.moduleIds) {
    const module = DESIGN_SYSTEM_MODULE.exec(id)?.groups?.module;
    if (
      module !== undefined &&
      renderers.has(module) &&
      module.slice(module.lastIndexOf("/") + 1) === chunk.name
    ) {
      return module;
    }
  }
}

/**
 * Names each lazy renderer's chunk after its module's path, so a test can tell which visual of the
 * catalog a page loaded. Rolldown names every other chunk after its module's file, and dozens of
 * renderers share a file name such as `lab` or `card`. A renderer that another module also imports
 * statically has no facade in its chunk, so the chunk is found by its name among its modules.
 */
function chunkFileName(renderers: ReadonlySet<string>) {
  return (chunk: Rolldown.PreRenderedChunk) => {
    const module = rendererOf(chunk, renderers);
    return module === undefined
      ? "assets/[name]-[hash].js"
      : `assets/${rendererChunkName(module)}-[hash].js`;
  };
}

/** The output of each environment, by its Vite environment name. */
export const ENVIRONMENT_OUTPUTS = {
  client: {
    build: {
      rolldownOptions: {
        output: {
          chunkFileNames: chunkFileName(new Set(lazyRendererModules())),
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
