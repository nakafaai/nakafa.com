import { fileURLToPath } from "node:url";
import { layer as nodeFileSystemLayer } from "@effect/platform-node/NodeFileSystem";
import { runMain } from "@effect/platform-node/NodeRuntime";
import { Effect, FileSystem, Schema } from "effect";
import { build } from "esbuild";

class CliBuildError extends Schema.TaggedError<CliBuildError>()(
  "CliBuildError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

const outputDirectory = fileURLToPath(new URL("../dist/", import.meta.url));
const outputFile = fileURLToPath(new URL("../dist/main.js", import.meta.url));
const entryPoint = fileURLToPath(new URL("../src/main.ts", import.meta.url));

const buildCli = Effect.fn("NakafaCli.build")(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
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

runMain(buildCli().pipe(Effect.provide(nodeFileSystemLayer)));
