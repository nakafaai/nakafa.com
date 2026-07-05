import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { Effect } from "effect";

const PUBLIC_DIR = "public";
const GENERATED_FULL_DIR = join(PUBLIC_DIR, "llms-full");
const GENERATED_INDEX_DIR = join(PUBLIC_DIR, "llms");

/** Loads Next.js environment files for this standalone build script. */
const loadNextEnvironment = Effect.sync(() => {
  loadEnvConfig(process.cwd());
});

/** Imports llms artifact builders after Next env has been loaded. */
const loadLlmsFullArtifacts = Effect.promise(
  () => import("@/lib/llms/full/artifacts")
);

/** Writes public llms-full files before Next.js builds static assets. */
const buildLlmsFullFiles = Effect.fn("scripts.llmsFull.build")(function* () {
  yield* loadNextEnvironment;

  const { getLlmsFullArtifacts } = yield* loadLlmsFullArtifacts;
  const artifacts = yield* getLlmsFullArtifacts();
  const files = [artifacts.root, artifacts.manifest, ...artifacts.shards];

  yield* Effect.tryPromise(() =>
    rm(GENERATED_FULL_DIR, { recursive: true, force: true })
  );
  yield* Effect.tryPromise(() =>
    rm(GENERATED_INDEX_DIR, { recursive: true, force: true })
  );
  yield* Effect.forEach(
    files,
    (artifact) =>
      Effect.gen(function* () {
        const outputPath = join(PUBLIC_DIR, artifact.path);

        yield* Effect.tryPromise(() =>
          mkdir(dirname(outputPath), { recursive: true })
        );
        yield* Effect.tryPromise(() => writeFile(outputPath, artifact.text));
      }),
    { concurrency: "unbounded", discard: true }
  );
});

Effect.runPromise(buildLlmsFullFiles());
