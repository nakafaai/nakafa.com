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

/** The most bytes, as Rolldown transformed it, of a module that joins the small modules' chunk. */
const SMALL_MODULE_BYTES = 8 * 1024;

/**
 * A script module. A stylesheet stays with the chunk that imports it, so no page
 * loads another route's styles or meets them in a new order.
 */
const SCRIPT_MODULE = /\.[cm]?[jt]sx?$/u;

/**
 * Whether the browser entry imports a module statically, so every page runs it
 * when it boots. A module met again inside a cycle reads as not booting, which
 * keeps a module out of the small modules' chunk rather than in it.
 */
function bootsWithEntry(
  moduleId: string,
  context: Rolldown.ChunkingContext,
  known: Map<string, boolean>
): boolean {
  const cached = known.get(moduleId);
  if (cached !== undefined) {
    return cached;
  }
  known.set(moduleId, false);
  const info = context.getModuleInfo(moduleId);
  const boots =
    info !== null &&
    (info.isEntry ||
      info.importers.some((importer) =>
        bootsWithEntry(importer, context, known)
      ));
  known.set(moduleId, boots);
  return boots;
}

/**
 * The code splitting of the browser's JavaScript, in two chunks besides the
 * routes' own.
 *
 * The boot chunk holds the modules that the browser entry imports statically.
 * Every page runs all of them when it boots, in the order a single-entry bundle
 * runs them, so no page loads or runs a byte more.
 *
 * The small modules' chunk holds every small module that imports nothing but
 * modules of the boot chunk: icons, constants, hooks. The boot chunk has run
 * before any of them loads, and none of them imports route code, so the chunk
 * changes no module's order against its imports and pulls nothing into the
 * boot. A page loads all of them once, about 40 KB compressed, in place of up
 * to a hundred requests.
 */
function browserCodeSplitting(): Rolldown.CodeSplittingOptions {
  const booted = new Map<string, boolean>();
  return {
    groups: [
      { name: "boot", priority: 1, tags: ["$initial"] },
      {
        maxModuleSize: SMALL_MODULE_BYTES,
        name: (moduleId, context) =>
          context
            .getModuleInfo(moduleId)
            ?.importedIds.every((imported) =>
              bootsWithEntry(imported, context, booted)
            )
            ? "small"
            : null,
        test: SCRIPT_MODULE,
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
