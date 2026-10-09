import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Path, Schema } from "effect";
import { build } from "esbuild";

class CliBuildError extends Schema.TaggedError<CliBuildError>()(
  "CliBuildError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

const buildCli = Effect.fn("NakafaCli.build")(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // Each URL is this script's own file URL, so it always converts to a path.
  const outputDirectory = yield* path
    .fromFileUrl(new URL("../dist/", import.meta.url))
    .pipe(Effect.orDie);
  const outputFile = yield* path
    .fromFileUrl(new URL("../dist/main.js", import.meta.url))
    .pipe(Effect.orDie);
  const entryPoint = yield* path
    .fromFileUrl(new URL("../src/main.ts", import.meta.url))
    .pipe(Effect.orDie);
  yield* fileSystem.remove(outputDirectory, { force: true, recursive: true });
  yield* Effect.tryPromise({
    catch: (cause) =>
      new CliBuildError({
        cause,
        message: "Unable to build the Nakafa CLI distribution.",
      }),
    try: () =>
      build({
        bundle: true,
        entryPoints: [entryPoint],
        format: "esm",
        legalComments: "none",
        outfile: outputFile,
        platform: "node",
        target: "node24",
      }),
  });
});

runMain(buildCli().pipe(Effect.provide(nodeServicesLayer)));
