import * as NodeServices from "@effect/platform-node/NodeServices";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  CONTENT_RUNTIME_CACHE_DIRECTORY,
  CONTENT_RUNTIME_CACHE_FILE,
  createPortableTable,
  formatManifest,
  formatMetadata,
} from "@repo/backend/content/snapshot/codec";
import { CONTENT_RUNTIME_TABLES } from "@repo/backend/content/snapshot/tables";
import type { ImportConfig } from "@repo/backend/scripts/content/runtime/ci/config";
import { readSignedRuntime } from "@repo/backend/scripts/content/runtime/ci/read";
import {
  makeRuntimeSource,
  TEST_SNAPSHOT_SELECTION_HASH,
} from "@repo/backend/test/content/snapshot";
import { Effect, FileSystem, Redacted } from "effect";

const mocks = vi.hoisted(() => ({
  decrypt: vi.fn(),
}));

vi.mock("@repo/backend/scripts/content/runtime/ci/archive", () => ({
  decryptAndExtractArchive: mocks.decrypt,
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
  mocks.decrypt.mockImplementation(({ snapshotRoot }: DecryptOptions) =>
    writeSnapshot(snapshotRoot)
  );
});

describe("authenticated serving snapshot reader", () => {
  it.live(
    "rejects operational state in an otherwise authenticated archive",
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
            yield* readSignedRuntime(config(runnerTemp)).pipe(Effect.flip)
          ).toMatchObject({
            message:
              "Signed runtime archive contains rows outside the active serving projection.",
          });
        }).pipe(Effect.provide(NodeServices.layer))
      )
  );

  it.live(
    "returns typed serving rows after removing the decrypted workspace",
    () =>
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

          const tables = yield* readSignedRuntime(config(runnerTemp));

          expect(mocks.decrypt).toHaveBeenCalledTimes(1);
          expect(Object.keys(tables)).toEqual(
            expect.arrayContaining([...CONTENT_RUNTIME_TABLES])
          );
          expect(tables.contentState).toEqual([makeRuntimeSource().state]);
          expect(yield* fileSystem.readDirectory(runnerTemp)).toEqual([
            CONTENT_RUNTIME_CACHE_DIRECTORY,
          ]);
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
            yield* readSignedRuntime(config(runnerTemp)).pipe(Effect.flip)
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
          yield* readSignedRuntime(config(runnerTemp)).pipe(Effect.flip)
        ).toMatchObject({
          message:
            "Signed runtime table set does not match the runtime contract.",
        });
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );
});
