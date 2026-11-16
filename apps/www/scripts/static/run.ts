/**
 * Runs the static runner's two jobs from `vite.config.ts`. `pages <file>` writes the
 * public paths that the build prerenders, before the client build. `artifacts
 * <outDir> <file>` writes the static artifacts of the release for those paths into
 * the client output, after the client build.
 *
 * The app's modules read Vite's own environment (`import.meta.env`) and resolve its
 * virtual modules, so the artifacts are rendered by Vite's module runner from the
 * same configuration, in Node. `NAKAFA_STATIC_RUNNER` turns off the Cloudflare
 * plugin and maps `cloudflare:workers` to the build shim for that run.
 */
import { NodeRuntime } from "@effect/platform-node";
import { Array as Arr, Effect, Match, Schema } from "effect";
import { createServer, createServerModuleRunner } from "vite";

/** The build module that Vite's runner loads, by its own types. */
type StaticBuild = typeof import("@/scripts/static/build");

const USAGE =
  "Usage: node scripts/static/run.ts pages <file> | artifacts <client output directory> <page list file>";

/** `pages <file>`: the list of paths the build prerenders goes to `file`. */
const PagesJob = Schema.Tuple([Schema.Literal("pages"), Schema.NonEmptyString]);

/** `artifacts <outDir> <file>`: the artifacts of the paths in `file` go into `outDir`. */
const ArtifactsJob = Schema.Tuple([
  Schema.Literal("artifacts"),
  Schema.NonEmptyString,
  Schema.NonEmptyString,
]);

/** The job the command line names, with the files it reads and writes. */
const StaticJob = Schema.Union([PagesJob, ArtifactsJob]);

/** The static runner could not read its job, start Vite's runner, or finish the job. */
class StaticRunError extends Schema.TaggedError<
  StaticRunError,
  { readonly brand: unique symbol }
>()("StaticRunError", { message: Schema.String }) {}

/** Vite's server in middleware mode, closed when the job ends however it ends. */
const viteServer = Effect.acquireRelease(
  Effect.tryPromise({
    try: () =>
      createServer({
        appType: "custom",
        configFile: "vite.config.ts",
        logLevel: "warn",
        root: process.cwd(),
        server: { hmr: false, middlewareMode: true, ws: false },
      }),
    catch: (cause) =>
      new StaticRunError({ message: `Vite did not start: ${String(cause)}` }),
  }),
  (server) => Effect.promise(() => server.close())
);

const run = Effect.fn("www.static.run")(function* (argv: readonly string[]) {
  const job = yield* Schema.decodeUnknownEffect(StaticJob)(argv).pipe(
    Effect.mapError(() => new StaticRunError({ message: USAGE }))
  );
  const server = yield* viteServer;
  const runner = yield* Effect.acquireRelease(
    Effect.sync(() => createServerModuleRunner(server.environments.ssr)),
    (moduleRunner) => Effect.promise(() => moduleRunner.close())
  );
  const build = yield* Effect.tryPromise({
    try: () => runner.import<StaticBuild>("/scripts/static/build.ts"),
    catch: (cause) =>
      new StaticRunError({
        message: `Vite could not load the build module: ${String(cause)}`,
      }),
  });
  yield* Effect.tryPromise({
    try: () =>
      Match.value(job).pipe(
        Match.when(Schema.is(PagesJob), ([, file]) =>
          build.buildStaticPagePaths(file)
        ),
        Match.when(Schema.is(ArtifactsJob), ([, outDir, pageListFile]) =>
          build.buildStaticArtifacts(outDir, pageListFile)
        ),
        Match.exhaustive
      ),
    catch: (cause) =>
      new StaticRunError({
        message: `The ${job[0]} job failed: ${String(cause)}`,
      }),
  });
});

// The caller, `vite.config.ts`, sets `NAKAFA_STATIC_RUNNER` in this process's environment.
NodeRuntime.runMain(run(Arr.drop(process.argv, 2)).pipe(Effect.scoped));
