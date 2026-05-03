import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import { getLlmsFullArtifacts } from "@/lib/llms/full/artifacts";

const PUBLIC_DIR = "public";
const GENERATED_SHARD_DIR = join(PUBLIC_DIR, "llms-full");

/** Writes public llms-full files before Next.js builds static assets. */
const buildLlmsFullFiles = Effect.fn("scripts.llmsFull.build")(function* () {
  const artifacts = yield* getLlmsFullArtifacts();
  const files = [artifacts.root, artifacts.manifest, ...artifacts.shards];

  yield* Effect.tryPromise(() =>
    rm(GENERATED_SHARD_DIR, { recursive: true, force: true })
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
