import tailwindcss from "@tailwindcss/vite";
import { Array as Arr, Data, Effect } from "effect";
import { build } from "vite";
import { type GLOBALS, shimName } from "#catalog/entry";

/** A Vite build of the page's scripts that failed. */
class BundleError extends Data.TaggedError("BundleError")<{
  readonly cause: unknown;
  readonly message: string;
}> {}

const DESIGN_SYSTEM = /^@repo\/design-system\//u;
const WORKSPACE = /^@repo\//u;

/** One production Vite build of an entry into a single classic script, with its stylesheet beside it. */
export const bundle = Effect.fn("designSystem.catalog.bundle")(
  function* (options: {
    readonly entry: string;
    readonly global: string;
    readonly file: string;
    readonly out: string;
    readonly packages: string;
    readonly work: string;
    readonly globals: readonly (keyof typeof GLOBALS)[];
  }) {
    const shims = Arr.map(options.globals, (module) => ({
      find: new RegExp(`^${module}$`, "u"),
      replacement: `${options.work}/${shimName(module)}`,
    }));
    yield* Effect.tryPromise({
      try: () =>
        build({
          configFile: false,
          logLevel: "warn",
          plugins: [tailwindcss()],
          define: { "process.env.NODE_ENV": '"production"' },
          resolve: {
            alias: [
              ...shims,
              {
                find: DESIGN_SYSTEM,
                replacement: `${options.packages}/design-system/`,
              },
              { find: WORKSPACE, replacement: `${options.packages}/` },
            ],
          },
          build: {
            outDir: options.out,
            emptyOutDir: false,
            minify: true,
            target: "es2022",
            cssCodeSplit: false,
            lib: {
              entry: options.entry,
              name: options.global,
              formats: ["iife"],
              fileName: () => `${options.file}.js`,
              cssFileName: options.file,
            },
            rolldownOptions: {
              /** The bundle is one classic script for the browser, so the libraries' "use client" lines mean nothing in it. */
              onLog: (level, log, handler) => {
                if (log.code !== "MODULE_LEVEL_DIRECTIVE") {
                  handler(level, log);
                }
              },
            },
          },
        }),
      catch: (cause) =>
        new BundleError({
          cause,
          message: `Vite could not build ${options.entry}.`,
        }),
    });
  }
);
