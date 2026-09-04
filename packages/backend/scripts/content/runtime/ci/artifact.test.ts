import { truncate } from "node:fs/promises";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { MAX_CONTENT_RUNTIME_ARCHIVE_BYTES } from "@repo/backend/content/archive";
import type {
  RuntimeArchiveReadConfig,
  RuntimeArchiveWriteConfig,
} from "@repo/backend/scripts/content/runtime/ci/access";
import {
  downloadRuntimeArchive,
  publishRuntimeArchive,
} from "@repo/backend/scripts/content/runtime/ci/artifact";
import {
  CONTENT_RUNTIME_CACHE_DIRECTORY,
  CONTENT_RUNTIME_CACHE_FILE,
} from "@repo/backend/scripts/content/runtime/ci/snapshot";
import { Effect, FileSystem, Redacted } from "effect";

const archiveBytes = new TextEncoder().encode("encrypted-runtime-archive");
const metadata = {
  archiveSha256:
    "e3765fbb7ee79916de02fe557bafe7aa37641457f1c4e8db73e4768b49d61745",
  byteLength: archiveBytes.byteLength,
  createdAt: 1_800_000_000_000,
  runtimeSelectionHash: "1".repeat(64),
  runtimeSchemaFingerprint: "2".repeat(64),
  sourceStateHash: "3".repeat(64),
};
const claimId = "00000000-0000-4000-8000-000000000001";

function readConfig(runnerTemp: string): RuntimeArchiveReadConfig {
  return {
    runnerTemp,
    runtimeSelectionHash: metadata.runtimeSelectionHash,
    runtimeSchemaFingerprint: metadata.runtimeSchemaFingerprint,
    runtimeToken: Redacted.make("technical-runtime-token"),
    siteUrl: "https://production.example.test",
  };
}

function writeConfig(
  runnerTemp: string
): RuntimeArchiveWriteConfig & { readonly contentStateHash: string } {
  return {
    archiveToken: Redacted.make("technical-archive-token"),
    contentStateHash: metadata.sourceStateHash,
    runnerTemp,
    runtimeSelectionHash: metadata.runtimeSelectionHash,
    runtimeSchemaFingerprint: metadata.runtimeSchemaFingerprint,
    siteUrl: "https://production.example.test",
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

describe("content runtime durable artifact", () => {
  it.live("publishes the exact bounded local encrypted file", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: "/tmp",
          prefix: "runtime-artifact-publish-",
        });
        const cacheRoot = `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
        yield* fileSystem.makeDirectory(cacheRoot);
        yield* fileSystem.writeFile(
          `${cacheRoot}/${CONTENT_RUNTIME_CACHE_FILE}`,
          archiveBytes
        );
        const fetcher = vi.fn<typeof fetch>();
        fetcher
          .mockResolvedValueOnce(
            jsonResponse({ uploadUrl: "https://upload.example.test/archive" })
          )
          .mockResolvedValueOnce(jsonResponse({ storageId: "storage-1" }))
          .mockResolvedValueOnce(jsonResponse({ kind: "stored", metadata }));

        expect(
          yield* publishRuntimeArchive(
            writeConfig(runnerTemp),
            claimId,
            fetcher
          )
        ).toEqual({ kind: "stored", metadata });
        expect(fetcher).toHaveBeenCalledTimes(3);
        expect(fetcher.mock.calls[0]?.[0]).toContain("/archive/upload");
        expect(
          new Headers(fetcher.mock.calls[0]?.[1]?.headers).get(
            "x-nakafa-archive-token"
          )
        ).toBe("technical-archive-token");
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );

  it.live(
    "rejects missing, non-file, empty, and oversized local archives",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const root = yield* fileSystem.makeTempDirectoryScoped({
            directory: "/tmp",
            prefix: "runtime-artifact-invalid-",
          });
          const fetcher = vi.fn<typeof fetch>();
          const cases = ["missing", "directory", "empty", "oversized"];

          for (const kind of cases) {
            const runnerTemp = `${root}/${kind}`;
            const cacheRoot = `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
            const path = `${cacheRoot}/${CONTENT_RUNTIME_CACHE_FILE}`;
            yield* fileSystem.makeDirectory(cacheRoot, { recursive: true });
            if (kind === "directory") {
              yield* fileSystem.makeDirectory(path);
            }
            if (kind === "empty" || kind === "oversized") {
              yield* fileSystem.writeFile(path, new Uint8Array());
            }
            if (kind === "oversized") {
              yield* Effect.promise(() =>
                truncate(path, MAX_CONTENT_RUNTIME_ARCHIVE_BYTES + 1)
              );
            }

            expect(
              yield* publishRuntimeArchive(
                writeConfig(runnerTemp),
                claimId,
                fetcher
              ).pipe(Effect.flip)
            ).toMatchObject({ _tag: "ContentRuntimeCiError" });
          }
          expect(fetcher).not.toHaveBeenCalled();
        }).pipe(Effect.provide(NodeServices.layer))
      )
  );

  it.live("checks an empty destination before any remote request", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: "/tmp",
          prefix: "runtime-artifact-preflight-",
        });
        const cacheRoot = `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
        yield* fileSystem.makeDirectory(cacheRoot);
        yield* fileSystem.writeFileString(`${cacheRoot}/foreign`, "occupied");
        const fetcher = vi.fn<typeof fetch>();

        expect(
          yield* downloadRuntimeArchive(readConfig(runnerTemp), fetcher).pipe(
            Effect.flip
          )
        ).toMatchObject({
          message:
            "Signed runtime cache directory must be empty before download.",
        });
        expect(fetcher).not.toHaveBeenCalled();
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );

  it.live("reports authenticated remote absence without creating a cache", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: "/tmp",
          prefix: "runtime-artifact-absent-",
        });
        const fetcher = vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            jsonResponse({ code: "CONTENT_RUNTIME_ARCHIVE_NOT_FOUND" }, 404)
          );

        expect(
          yield* downloadRuntimeArchive(readConfig(runnerTemp), fetcher).pipe(
            Effect.flip
          )
        ).toMatchObject({
          message: "Immutable signed runtime archive is not available.",
        });
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(
          yield* fileSystem.exists(
            `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`
          )
        ).toBe(false);
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );

  it.live("downloads one metadata-bound capability into a private cache", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: "/tmp",
          prefix: "runtime-artifact-download-",
        });
        const fetcher = vi.fn<typeof fetch>();
        fetcher
          .mockResolvedValueOnce(
            jsonResponse({
              ...metadata,
              downloadUrl: "https://storage.example.test/archive",
            })
          )
          .mockResolvedValueOnce(new Response(archiveBytes, { status: 200 }));
        const cacheRoot = `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
        const archivePath = `${cacheRoot}/${CONTENT_RUNTIME_CACHE_FILE}`;
        const rename = fileSystem.rename.bind(fileSystem);
        const renameSpy = vi
          .spyOn(fileSystem, "rename")
          .mockImplementation((temporaryPath, destinationPath) =>
            Effect.gen(function* () {
              expect(destinationPath).toBe(archivePath);
              expect(yield* fileSystem.exists(archivePath)).toBe(false);
              expect(
                Array.from(yield* fileSystem.readFile(temporaryPath))
              ).toEqual(Array.from(archiveBytes));
              yield* rename(temporaryPath, destinationPath);
            })
          );

        expect(
          yield* downloadRuntimeArchive(readConfig(runnerTemp), fetcher).pipe(
            Effect.ensuring(Effect.sync(() => renameSpy.mockRestore()))
          )
        ).toEqual(metadata);
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(Array.from(yield* fileSystem.readFile(archivePath))).toEqual(
          Array.from(archiveBytes)
        );
        expect(yield* fileSystem.readDirectory(cacheRoot)).toEqual([
          CONTENT_RUNTIME_CACHE_FILE,
        ]);
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );

  it.live("removes staged bytes when atomic promotion fails", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: "/tmp",
          prefix: "runtime-artifact-atomic-",
        });
        const cacheRoot = `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
        const archivePath = `${cacheRoot}/${CONTENT_RUNTIME_CACHE_FILE}`;
        const fetcher = vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(
            jsonResponse({
              ...metadata,
              downloadUrl: "https://storage.example.test/archive",
            })
          )
          .mockResolvedValueOnce(new Response(archiveBytes, { status: 200 }));
        const rename = fileSystem.rename.bind(fileSystem);
        const renameSpy = vi
          .spyOn(fileSystem, "rename")
          .mockImplementation((_temporaryPath, destinationPath) =>
            rename(`${cacheRoot}/missing`, destinationPath)
          );

        expect(
          yield* downloadRuntimeArchive(readConfig(runnerTemp), fetcher).pipe(
            Effect.flip,
            Effect.ensuring(Effect.sync(() => renameSpy.mockRestore()))
          )
        ).toMatchObject({ _tag: "PlatformError" });
        expect(yield* fileSystem.exists(archivePath)).toBe(false);
        expect(yield* fileSystem.readDirectory(cacheRoot)).toEqual([]);
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );
});
