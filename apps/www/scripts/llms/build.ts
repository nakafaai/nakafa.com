import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { Effect } from "effect";

const PUBLIC_DIR = "public";
const GENERATED_FULL_DIR = join(PUBLIC_DIR, "llms-full");
const GENERATED_PAGE_CATALOG_DIR = join(PUBLIC_DIR, "llms");

/** Loads Next.js environment files for this standalone build script. */
const loadNextEnvironment = Effect.sync(() => {
  loadEnvConfig(process.cwd());
});

/** Imports llms artifact builders after Next env has been loaded. */
const loadLlmsArtifacts = Effect.all(
  {
    full: Effect.tryPromise(() => import("@/lib/llms/full/artifacts")),
    pageCatalog: Effect.tryPromise(() => import("@/lib/llms/page-catalog")),
  },
  { concurrency: 2 }
);

/** Writes public llms files before Next.js builds static assets. */
const buildLlmsFiles = Effect.fn("scripts.llms.build")(function* () {
  yield* loadNextEnvironment;

  const { full, pageCatalog } = yield* loadLlmsArtifacts;
  const { getLlmsFullArtifacts } = full;
  const { getLlmsPageCatalogArtifacts } = pageCatalog;
  const fullArtifacts = yield* getLlmsFullArtifacts();
  const pageCatalogArtifacts = yield* getLlmsPageCatalogArtifacts();
  const files = [
    fullArtifacts.root,
    fullArtifacts.manifest,
    ...fullArtifacts.shards,
    ...pageCatalogArtifacts,
  ];

  yield* Effect.tryPromise(() =>
    rm(GENERATED_FULL_DIR, { recursive: true, force: true })
  );
  yield* Effect.tryPromise(() =>
    rm(GENERATED_PAGE_CATALOG_DIR, { recursive: true, force: true })
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
    { concurrency: 4, discard: true }
  );
});

Effect.runPromise(buildLlmsFiles());
