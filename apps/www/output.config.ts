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
 * as down. Rolldown puts every module that two dynamic imports share in a common
 * chunk of its own, and 187 of the 217 files every page booted with were under
 * 5 KB. `BOOT_SCRIPT_LIMIT` in `src/lib/static/scripts.ts` fails a build whose
 * page boots too many.
 */

/** The most bytes, as Rolldown transformed it, of a module that joins a small chunk. */
const SMALL_MODULE_BYTES = 8 * 1024;

/**
 * The most bytes of the small modules that the same routes share, below which
 * they join the chunk of the routes that share the most with them.
 */
const SMALL_CHUNK_BYTES = 64 * 1024;

/**
 * A script module. A stylesheet stays with the chunk that imports it, so no page
 * loads another route's styles or meets them in a new order.
 */
const SCRIPT_MODULE = /\.[cm]?[jt]sx?$/u;

/**
 * Whether the browser entry imports a module statically, so every page runs it
 * when it boots. A module met again inside a cycle reads as not booting, which
 * keeps a module out of the small chunks rather than in them.
 */
function bootsWithEntry(
  moduleId: string,
  context: Rolldown.ChunkingContext,
  booted: Map<string, boolean>
): boolean {
  const known = booted.get(moduleId);
  if (known !== undefined) {
    return known;
  }
  booted.set(moduleId, false);
  const info = context.getModuleInfo(moduleId);
  const boots =
    info !== null &&
    (info.isEntry ||
      info.importers.some((importer) =>
        bootsWithEntry(importer, context, booted)
      ));
  booted.set(moduleId, boots);
  return boots;
}

/**
 * The depth of a small module: 0 when it imports nothing but boot modules, and
 * otherwise one more than the deepest small module it imports. A boot module, a
 * stylesheet, a module over `SMALL_MODULE_BYTES`, and a module that imports any
 * of the last two or sits on an import cycle have none, so they keep the chunks
 * Rolldown gives them.
 */
function smallDepth(
  moduleId: string,
  context: Rolldown.ChunkingContext,
  booted: Map<string, boolean>,
  depths: Map<string, number | null>
): number | null {
  if (depths.has(moduleId)) {
    return depths.get(moduleId) ?? null;
  }
  depths.set(moduleId, null);
  const info = context.getModuleInfo(moduleId);
  if (
    info === null ||
    !SCRIPT_MODULE.test(moduleId) ||
    (info.code?.length ?? Number.POSITIVE_INFINITY) > SMALL_MODULE_BYTES ||
    bootsWithEntry(moduleId, context, booted)
  ) {
    return null;
  }
  let depth = 0;
  for (const imported of info.importedIds) {
    if (bootsWithEntry(imported, context, booted)) {
      continue;
    }
    const below = smallDepth(imported, context, booted, depths);
    if (below === null) {
      return null;
    }
    depth = Math.max(depth, below + 1);
  }
  depths.set(moduleId, depth);
  return depth;
}

/**
 * The code splitting of the browser's JavaScript.
 *
 * The boot chunk holds the modules that the browser entry imports statically.
 * Every page runs all of them when it boots, in the order a single-entry bundle
 * runs them, so no page loads or runs a byte more.
 *
 * The small chunks hold the small modules that two or more routes share: icons,
 * constants, schemas, hooks. A small module imports only boot modules and other
 * small modules, and the modules of one depth are cut by the routes that use
 * them, a cut under `SMALL_CHUNK_BYTES` joining its nearest neighbour. A small
 * chunk therefore imports only the boot chunk and small chunks of a lower depth:
 * no two chunks import each other, so every module still runs after its imports
 * (the cycles of #1835), and no route code joins the boot. A page loads a few
 * small chunks in place of up to a hundred files. One small chunk for every
 * route loaded 1.7 MB on every page, and one cut of every depth together left
 * pages with 111 scripts (13 November 2026).
 */
function browserCodeSplitting(): Rolldown.CodeSplittingOptions {
  const booted = new Map<string, boolean>();
  const depths = new Map<string, number | null>();
  return {
    groups: [
      { name: "boot", priority: 1, tags: ["$initial"] },
      {
        entriesAware: true,
        entriesAwareMergeThreshold: SMALL_CHUNK_BYTES,
        // Each import of a small module is a boot module or a small module of a
        // lower depth, which its own group takes.
        includeDependenciesRecursively: false,
        minShareCount: 2,
        name: (moduleId, context) => {
          const depth = smallDepth(moduleId, context, booted, depths);
          return depth === null ? null : `small${depth}`;
        },
      },
    ],
  };
}

/** The output of each environment, by its Vite environment name. */
export const ENVIRONMENT_OUTPUTS = {
  client: {
    build: {
      rolldownOptions: { output: { codeSplitting: browserCodeSplitting() } },
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
