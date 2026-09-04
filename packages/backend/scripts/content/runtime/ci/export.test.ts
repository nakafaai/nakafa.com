import { dirname } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { ExportConfig } from "@repo/backend/scripts/content/runtime/ci/config";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import { exportSignedRuntime } from "@repo/backend/scripts/content/runtime/ci/export";
import {
  CONTENT_RUNTIME_CACHE_DIRECTORY,
  CONTENT_RUNTIME_CACHE_FILE,
} from "@repo/backend/scripts/content/runtime/ci/snapshot";
import { CONTENT_RUNTIME_TABLES } from "@repo/backend/scripts/content/runtime/tables";
import { Effect, FileSystem, Redacted } from "effect";

const mocks = vi.hoisted(() => ({
  createArchive: vi.fn(),
  readGenerations: vi.fn(),
  readSchemaFingerprint: vi.fn(),
  runData: vi.fn(),
  verifyStable: vi.fn(),
}));

vi.mock("@repo/backend/scripts/content/runtime/ci/archive", () => ({
  createEncryptedArchive: mocks.createArchive,
}));

vi.mock("@repo/backend/scripts/content/runtime/ci/command", () => ({
  runConvexData: mocks.runData,
}));

vi.mock("@repo/backend/scripts/content/runtime/ci/generation", () => ({
  readProductionGenerations: mocks.readGenerations,
  verifyStableRuntimeExport: mocks.verifyStable,
}));

vi.mock(
  "@repo/backend/scripts/content/runtime/tables",
  async (importOriginal) => ({
    ...(await importOriginal()),
    readContentRuntimeSchemaFingerprint: mocks.readSchemaFingerprint,
  })
);

const contentStateHash = "1".repeat(64);
const runtimeSchemaFingerprint = "2".repeat(64);
const events: string[] = [];
const rowsByTable = new Map<string, readonly Record<string, unknown>[]>();

interface DataOptions {
  readonly outputPath: string;
  readonly table: string;
}

interface ArchiveOptions {
  readonly encryptedPath: string;
}

function config(runnerTemp: string, exportLimit = 2): ExportConfig {
  return {
    cacheKey: Redacted.make("k".repeat(43)),
    contentStateHash,
    deployKey: Redacted.make("production-deploy-key"),
    exportLimit,
    runnerTemp,
    runtimeSchemaFingerprint,
  };
}

beforeEach(() => {
  events.length = 0;
  rowsByTable.clear();
  mocks.createArchive.mockReset();
  mocks.readGenerations.mockReset();
  mocks.readSchemaFingerprint.mockReset();
  mocks.runData.mockReset();
  mocks.verifyStable.mockReset();

  mocks.readGenerations.mockImplementation(() =>
    Effect.sync(() => {
      events.push("generation");
      return { contentStateHash, runtimeSelectionHash: "3".repeat(64) };
    })
  );
  mocks.verifyStable.mockImplementation(() =>
    Effect.sync(() => {
      events.push("verify");
    })
  );
  mocks.runData.mockImplementation((options: DataOptions) =>
    Effect.gen(function* () {
      events.push(`data:${options.table}`);
      const fileSystem = yield* FileSystem.FileSystem;
      yield* fileSystem.writeFileString(
        options.outputPath,
        JSON.stringify(rowsByTable.get(options.table) ?? [])
      );
    })
  );
  mocks.createArchive.mockImplementation((options: ArchiveOptions) =>
    Effect.gen(function* () {
      events.push("archive");
      const fileSystem = yield* FileSystem.FileSystem;
      yield* fileSystem.writeFileString(options.encryptedPath, "encrypted");
    })
  );
  mocks.readSchemaFingerprint.mockImplementation(() =>
    Effect.sync(() => {
      events.push("schema");
      return runtimeSchemaFingerprint;
    })
  );
});

describe("signed runtime export", () => {
  it.live(
    "verifies a stable generation before and after exporting every table",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
            directory: "/tmp",
            prefix: "runtime-export-stable-",
          });
          const cacheRoot = `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
          yield* fileSystem.makeDirectory(cacheRoot);
          rowsByTable.set("contentState", [
            { _creationTime: 1, _id: "source", value: "portable" },
          ]);

          yield* exportSignedRuntime(config(runnerTemp));

          expect(mocks.verifyStable).toHaveBeenCalledTimes(2);
          expect(mocks.runData).toHaveBeenCalledTimes(
            CONTENT_RUNTIME_TABLES.length
          );
          expect(events.at(0)).toBe("generation");
          expect(events.at(1)).toBe("verify");
          expect(events.indexOf("verify")).toBeLessThan(
            events.findIndex((event) => event.startsWith("data:"))
          );
          expect(events.lastIndexOf("verify")).toBeLessThan(
            events.indexOf("archive")
          );
          expect(events.at(-1)).toBe("schema");
          expect(
            yield* fileSystem.exists(
              `${cacheRoot}/${CONTENT_RUNTIME_CACHE_FILE}`
            )
          ).toBe(true);
        }).pipe(Effect.provide(NodeServices.layer))
      )
  );

  it.live("rejects a changed generation before any export side effect", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: "/tmp",
          prefix: "runtime-export-preflight-",
        });
        mocks.verifyStable.mockReturnValueOnce(
          Effect.fail(contentRuntimeCiError("generation changed"))
        );

        expect(
          yield* exportSignedRuntime(config(runnerTemp)).pipe(Effect.flip)
        ).toMatchObject({ message: "generation changed" });
        expect(mocks.runData).not.toHaveBeenCalled();
        expect(mocks.createArchive).not.toHaveBeenCalled();
        expect(
          yield* fileSystem.exists(
            `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`
          )
        ).toBe(false);
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );

  it.live(
    "rejects and removes a nonempty destination before fetching data",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
            directory: "/tmp",
            prefix: "runtime-export-destination-",
          });
          const cacheRoot = `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
          yield* fileSystem.makeDirectory(cacheRoot);
          yield* fileSystem.writeFileString(
            `${cacheRoot}/unexpected`,
            "unsafe"
          );

          expect(
            yield* exportSignedRuntime(config(runnerTemp)).pipe(Effect.flip)
          ).toMatchObject({
            message:
              "Signed runtime cache directory must be empty before export.",
          });
          expect(mocks.runData).not.toHaveBeenCalled();
          expect(yield* fileSystem.exists(cacheRoot)).toBe(false);
        }).pipe(Effect.provide(NodeServices.layer))
      )
  );

  it.live("fails closed when a table reaches the configured export bound", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: "/tmp",
          prefix: "runtime-export-bound-",
        });
        const boundedTable = "contentState";
        expect(CONTENT_RUNTIME_TABLES).toContain(boundedTable);
        rowsByTable.set(boundedTable, [{ value: 1 }, { value: 2 }]);

        expect(
          yield* exportSignedRuntime(config(runnerTemp, 2)).pipe(Effect.flip)
        ).toMatchObject({
          message: `Content runtime table ${boundedTable} reached the export limit.`,
        });
        expect(mocks.createArchive).not.toHaveBeenCalled();
        expect(
          yield* fileSystem.exists(
            `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`
          )
        ).toBe(false);
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );

  it.live("rejects missing and misnamed encrypted archive output", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        for (const mode of ["missing", "misnamed"] as const) {
          const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
            directory: "/tmp",
            prefix: `runtime-export-${mode}-`,
          });
          mocks.createArchive.mockImplementationOnce(
            (options: ArchiveOptions) =>
              mode === "missing"
                ? Effect.void
                : fileSystem.writeFileString(
                    `${dirname(options.encryptedPath)}/unexpected.gpg`,
                    "encrypted"
                  )
          );

          expect(
            yield* exportSignedRuntime(config(runnerTemp)).pipe(Effect.flip)
          ).toMatchObject({
            message: "Encrypted signed runtime must be the only cache entry.",
          });
          expect(
            yield* fileSystem.exists(
              `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`
            )
          ).toBe(false);
        }
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );

  it.live("removes a completed archive when its schema identity changed", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: "/tmp",
          prefix: "runtime-export-schema-",
        });
        mocks.readSchemaFingerprint.mockReturnValueOnce(
          Effect.succeed("f".repeat(64))
        );

        expect(
          yield* exportSignedRuntime(config(runnerTemp)).pipe(Effect.flip)
        ).toMatchObject({
          message:
            "Runtime schema fingerprint changed after cache identity creation.",
        });
        expect(mocks.createArchive).toHaveBeenCalledTimes(1);
        expect(
          yield* fileSystem.exists(
            `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`
          )
        ).toBe(false);
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );
});
