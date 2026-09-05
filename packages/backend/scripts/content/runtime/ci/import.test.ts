import * as NodeServices from "@effect/platform-node/NodeServices";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { ImportConfig } from "@repo/backend/scripts/content/runtime/ci/config";
import { importSignedRuntime } from "@repo/backend/scripts/content/runtime/ci/import";
import {
  CONTENT_RUNTIME_CACHE_DIRECTORY,
  CONTENT_RUNTIME_CACHE_FILE,
  createPortableTable,
  formatManifest,
  formatMetadata,
} from "@repo/backend/scripts/content/runtime/ci/snapshot";
import { CONTENT_RUNTIME_TABLES } from "@repo/backend/scripts/content/runtime/tables";
import {
  makeRuntimeSource,
  TEST_SNAPSHOT_SELECTION_HASH,
} from "@repo/backend/test/content/snapshot";
import { Effect, FileSystem, Redacted } from "effect";

const mocks = vi.hoisted(() => ({
  decrypt: vi.fn(),
  runImport: vi.fn(),
}));

vi.mock("@repo/backend/scripts/content/runtime/ci/archive", () => ({
  decryptAndExtractArchive: mocks.decrypt,
}));

vi.mock("@repo/backend/scripts/content/runtime/ci/command", () => ({
  runConvexImport: mocks.runImport,
}));

const identity = {
  runtimeSchemaFingerprint: "2".repeat(64),
  runtimeSelectionHash: TEST_SNAPSHOT_SELECTION_HASH,
};

interface DecryptOptions {
  readonly snapshotRoot: string;
}

function config(runnerTemp: string): ImportConfig {
  return {
    ...identity,
    cacheKey: Redacted.make("k".repeat(43)),
    runnerTemp,
  };
}

const writeSnapshot = Effect.fn("RuntimeImportTest.writeSnapshot")(function* (
  snapshotRoot: string,
  tables = CONTENT_RUNTIME_TABLES,
  source = makeRuntimeSource().source
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const entries = CONTENT_RUNTIME_TABLES.map(
    (table) => createPortableTable(table, source.get(table) ?? []).entry
  );
  yield* fileSystem.writeFileString(
    `${snapshotRoot}/metadata.json`,
    formatMetadata(identity)
  );
  yield* fileSystem.writeFileString(
    `${snapshotRoot}/tables.txt`,
    `${tables.join("\n")}\n`
  );
  yield* fileSystem.writeFileString(
    `${snapshotRoot}/manifest.jsonl`,
    formatManifest(entries)
  );
  for (const table of CONTENT_RUNTIME_TABLES) {
    yield* fileSystem.writeFileString(
      `${snapshotRoot}/${table}.jsonl`,
      createPortableTable(table, source.get(table) ?? []).jsonLines
    );
  }
});

beforeEach(() => {
  mocks.decrypt.mockReset();
  mocks.runImport.mockReset();
  mocks.decrypt.mockImplementation(({ snapshotRoot }: DecryptOptions) =>
    writeSnapshot(snapshotRoot)
  );
  mocks.runImport.mockReturnValue(Effect.void);
});

describe("signed runtime import", () => {
  it.live(
    "rejects operational state in an otherwise authenticated archive before importing any table",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
            directory: "/tmp",
            prefix: "runtime-import-operational-",
          });
          const cacheRoot = `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
          yield* fileSystem.makeDirectory(cacheRoot);
          yield* fileSystem.writeFileString(
            `${cacheRoot}/${CONTENT_RUNTIME_CACHE_FILE}`,
            "encrypted"
          );
          mocks.decrypt.mockImplementation(
            ({ snapshotRoot }: DecryptOptions) => {
              const { source, state } = makeRuntimeSource();
              source.set("contentState", [
                {
                  ...state,
                  candidateManifestHash: state.activeManifestHash,
                  candidateReleaseId: "candidate",
                  candidateSequence: 10,
                },
              ]);
              return writeSnapshot(
                snapshotRoot,
                CONTENT_RUNTIME_TABLES,
                source
              );
            }
          );
          expect(
            yield* importSignedRuntime(config(runnerTemp)).pipe(Effect.flip)
          ).toMatchObject({
            message:
              "Signed runtime archive contains rows outside the active serving projection.",
          });
          expect(mocks.runImport).not.toHaveBeenCalled();
        }).pipe(Effect.provide(NodeServices.layer))
      )
  );

  it.live("validates and imports every signed table", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: "/tmp",
          prefix: "runtime-import-valid-",
        });
        const cacheRoot = `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
        yield* fileSystem.makeDirectory(cacheRoot);
        yield* fileSystem.writeFileString(
          `${cacheRoot}/${CONTENT_RUNTIME_CACHE_FILE}`,
          "encrypted"
        );

        yield* importSignedRuntime(config(runnerTemp));

        expect(mocks.decrypt).toHaveBeenCalledTimes(1);
        expect(mocks.runImport).toHaveBeenCalledTimes(
          CONTENT_RUNTIME_TABLES.length
        );
        expect(mocks.runImport).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ table: CONTENT_RUNTIME_TABLES[0] })
        );
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );

  it.live("rejects an empty file or non-file input", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        for (const mode of ["empty", "directory"] as const) {
          const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
            directory: "/tmp",
            prefix: `runtime-import-${mode}-`,
          });
          const cacheRoot = `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
          const encryptedPath = `${cacheRoot}/${CONTENT_RUNTIME_CACHE_FILE}`;
          yield* fileSystem.makeDirectory(cacheRoot);
          if (mode === "empty") {
            yield* fileSystem.writeFileString(encryptedPath, "");
          } else {
            yield* fileSystem.makeDirectory(encryptedPath);
          }

          expect(
            yield* importSignedRuntime(config(runnerTemp)).pipe(Effect.flip)
          ).toMatchObject({
            message: "Encrypted signed runtime cache is missing.",
          });
          expect(mocks.decrypt).not.toHaveBeenCalled();
        }
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );

  it.live("rejects a snapshot with a different table contract", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: "/tmp",
          prefix: "runtime-import-tables-",
        });
        const cacheRoot = `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
        yield* fileSystem.makeDirectory(cacheRoot);
        yield* fileSystem.writeFileString(
          `${cacheRoot}/${CONTENT_RUNTIME_CACHE_FILE}`,
          "encrypted"
        );
        mocks.decrypt.mockImplementationOnce(
          ({ snapshotRoot }: DecryptOptions) =>
            writeSnapshot(snapshotRoot, ["wrong"])
        );

        expect(
          yield* importSignedRuntime(config(runnerTemp)).pipe(Effect.flip)
        ).toMatchObject({
          message:
            "Signed runtime table set does not match the runtime contract.",
        });
        expect(mocks.runImport).not.toHaveBeenCalled();
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );
});
