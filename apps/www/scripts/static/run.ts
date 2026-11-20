/**
 * Runs the static runner of one build, which `vite.config.ts` starts as
 * `build <page list file>` with an IPC channel before the client build
 * (`static.config.ts`). It writes the public paths that the build prerenders and
 * tells the build so. Then it derives the Markdown twins and parses the diagrams
 * of those pages while the client build and the prerender run, and once the build
 * sends it the client output directory, it writes the static artifacts there and
 * ends. The app's modules load once for all of it.
 *
 * The app's modules read Vite's own environment (`import.meta.env`) and resolve its
 * virtual modules, so the artifacts are rendered by Vite's module runner from the
 * same configuration, in Node. `NAKAFA_STATIC_RUNNER` turns off the Cloudflare
 * plugin and maps `cloudflare:workers` to the build shim for that run.
 */
import { NodeRuntime } from "@effect/platform-node";
import { Array as Arr, Effect, Fiber, Formatter, Schema } from "effect";
import { createServer, createServerModuleRunner } from "vite";
import type { RunnerMessage } from "#www/static.config";
import { PagesListed, WriteArtifacts } from "#www/static.config";

/** The build module that Vite's runner loads, by its own types. */
type StaticBuild = typeof import("@/scripts/static/build");

const USAGE =
  "Usage: vite.config.ts starts node scripts/static/run.ts build <page list file> with an IPC channel";

/** `build <file>`: the list of paths the build prerenders goes to `file`, and the artifacts follow. */
const BuildJob = Schema.Tuple([Schema.Literal("build"), Schema.NonEmptyString]);

/** The static runner could not read its job, start Vite's runner, talk to the build, or finish the job. */
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
        // The client build writes thousands of files while this runner waits, and none is a module it loads.
        server: { hmr: false, middlewareMode: true, watch: null, ws: false },
      }),
    catch: (cause) =>
      new StaticRunError({ message: `Vite did not start: ${String(cause)}` }),
  }),
  (server) => Effect.promise(() => server.close())
);

/**
 * The IPC channel to the build that started this runner, closed when the job ends
 * so the runner exits. A runner started without one has no build to answer.
 */
const buildChannel = Effect.acquireRelease(
  Effect.suspend(() => {
    const send = process.send?.bind(process);
    const disconnect = process.disconnect?.bind(process);
    return send === undefined || disconnect === undefined
      ? Effect.fail(new StaticRunError({ message: USAGE }))
      : Effect.succeed({ disconnect, send });
  }),
  ({ disconnect }) =>
    Effect.sync(() => {
      if (process.connected) {
        disconnect();
      }
    })
);

/** Tells the build one message over the channel. */
const tell = (
  send: NonNullable<typeof process.send>,
  message: typeof RunnerMessage.Type
) =>
  Effect.callback<void, StaticRunError>((resume) => {
    send(message, undefined, undefined, (error) => {
      resume(
        error === null
          ? Effect.void
          : Effect.fail(
              new StaticRunError({
                message: `The build did not hear the runner: ${String(error)}`,
              })
            )
      );
    });
  });

/**
 * The client output directory, once the build has written its pages and asks for
 * the artifacts. A build that ends without asking takes its runner with it.
 */
const askedOutDir = Effect.callback<string, StaticRunError>((resume) => {
  const onMessage = (message: unknown) => {
    if (Schema.is(WriteArtifacts)(message)) {
      resume(Effect.succeed(message.outDir));
    }
  };
  const onDisconnect = () =>
    resume(
      Effect.fail(
        new StaticRunError({
          message: "The build ended without asking for the static artifacts.",
        })
      )
    );
  process.on("message", onMessage);
  process.once("disconnect", onDisconnect);
  return Effect.sync(() => {
    process.off("message", onMessage);
    process.off("disconnect", onDisconnect);
  });
});

/**
 * Runs one step of the build module, naming the step when it fails. The failure
 * prints with its fields, because a tagged error without a `message` prints its
 * tag alone, which hid the reason of every failed production page list.
 */
const step = <A>(name: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new StaticRunError({
        message: `The static ${name} failed: ${Formatter.formatJson(cause)}`,
      }),
  });

const run = Effect.fn("www.static.run")(function* (argv: readonly string[]) {
  const [, pageListFile] = yield* Schema.decodeUnknownEffect(BuildJob)(
    argv
  ).pipe(Effect.mapError(() => new StaticRunError({ message: USAGE })));
  const { send } = yield* buildChannel;
  const asked = yield* Effect.forkScoped(askedOutDir);
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
  yield* step("page list", () => build.buildStaticPagePaths(pageListFile));
  yield* tell(send, PagesListed.make({ file: pageListFile }));
  const prepared = yield* Effect.forkScoped(
    step("preparation", () => build.prepareStaticArtifacts(pageListFile))
  );
  const outDir = yield* Fiber.join(asked);
  const artifacts = yield* Fiber.join(prepared);
  yield* step("artifacts", () => build.writeStaticArtifacts(outDir, artifacts));
});

// The caller, `static.config.ts`, sets `NAKAFA_STATIC_RUNNER` in this process's environment.
NodeRuntime.runMain(run(Arr.drop(process.argv, 2)).pipe(Effect.scoped));
