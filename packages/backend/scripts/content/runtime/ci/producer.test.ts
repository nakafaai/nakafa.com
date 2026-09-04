import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import type { ProducerConfig } from "@repo/backend/scripts/content/runtime/ci/access";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import { exportSignedRuntime } from "@repo/backend/scripts/content/runtime/ci/export";
import { produceRuntimeArchive } from "@repo/backend/scripts/content/runtime/ci/producer";
import {
  CONTENT_RUNTIME_CACHE_DIRECTORY,
  CONTENT_RUNTIME_CACHE_FILE,
} from "@repo/backend/scripts/content/runtime/ci/snapshot";
import { Effect, FileSystem, Redacted } from "effect";

const bytes = new TextEncoder().encode("encrypted-runtime-archive");
const metadata = {
  archiveSha256:
    "e3765fbb7ee79916de02fe557bafe7aa37641457f1c4e8db73e4768b49d61745",
  byteLength: bytes.byteLength,
  contentStateHash: "1".repeat(64),
  createdAt: 1_800_000_000_000,
  runtimeSchemaFingerprint: "2".repeat(64),
};

function config(runnerTemp: string): ProducerConfig {
  return {
    archiveToken: Redacted.make("technical-archive-token"),
    cacheKey: Redacted.make("k".repeat(43)),
    contentStateHash: metadata.contentStateHash,
    deployKey: Redacted.make("production-deploy-key"),
    exportLimit: 100_000,
    runnerTemp,
    runtimeSchemaFingerprint: metadata.runtimeSchemaFingerprint,
    runtimeToken: Redacted.make("technical-runtime-token"),
    siteUrl: "https://production.example.test",
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

describe("content runtime archive producer", () => {
  it.live(
    "skips every export side effect when the immutable archive exists",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
            directory: "/tmp",
            prefix: "runtime-producer-existing-",
          });
          const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValue(jsonResponse({ kind: "existing", metadata }));
          const exporter = vi.fn(exportSignedRuntime);

          expect(
            yield* produceRuntimeArchive(config(runnerTemp), fetcher, exporter)
          ).toEqual({ kind: "unchanged", metadata });
          expect(exporter).not.toHaveBeenCalled();
          expect(fetcher).toHaveBeenCalledTimes(1);
        }).pipe(Effect.provide(NodeServices.layer))
      )
  );

  it.live("does not export while another producer owns the lease", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: "/tmp",
          prefix: "runtime-producer-busy-",
        });
        const fetcher = vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            jsonResponse({ expiresAt: Date.now() + 60_000, kind: "busy" })
          );
        const exporter = vi.fn(exportSignedRuntime);

        expect(
          yield* produceRuntimeArchive(
            config(runnerTemp),
            fetcher,
            exporter
          ).pipe(Effect.flip)
        ).toMatchObject({
          message:
            "Immutable signed runtime archive is being produced by another run.",
        });
        expect(exporter).not.toHaveBeenCalled();
        expect(fetcher).toHaveBeenCalledTimes(1);
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );

  it.live(
    "exports only after claiming and releases after immutable storage",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
            directory: "/tmp",
            prefix: "runtime-producer-store-",
          });
          const cacheRoot = `${runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
          const exporter = vi.fn<typeof exportSignedRuntime>(() =>
            Effect.gen(function* () {
              yield* fileSystem.makeDirectory(cacheRoot);
              yield* fileSystem.writeFile(
                `${cacheRoot}/${CONTENT_RUNTIME_CACHE_FILE}`,
                bytes
              );
            }).pipe(Effect.as(undefined))
          );
          const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
              jsonResponse({ expiresAt: Date.now() + 60_000, kind: "claimed" })
            )
            .mockResolvedValueOnce(
              jsonResponse({ expiresAt: Date.now() + 60_000, kind: "claimed" })
            )
            .mockResolvedValueOnce(
              jsonResponse({ uploadUrl: "https://upload.example.test/archive" })
            )
            .mockResolvedValueOnce(jsonResponse({ storageId: "storage-1" }))
            .mockResolvedValueOnce(jsonResponse({ kind: "stored", metadata }))
            .mockResolvedValueOnce(jsonResponse({ released: false }));

          expect(
            yield* produceRuntimeArchive(config(runnerTemp), fetcher, exporter)
          ).toEqual({ kind: "stored", metadata });
          expect(exporter).toHaveBeenCalledTimes(1);
          expect(fetcher).toHaveBeenCalledTimes(6);
          expect(fetcher.mock.calls.map((call) => String(call[0]))).toEqual([
            expect.stringContaining("/archive/claim"),
            expect.stringContaining("/archive/claim"),
            expect.stringContaining("/archive/upload"),
            "https://upload.example.test/archive",
            expect.stringContaining("/archive/finalize"),
            expect.stringContaining("/archive/release"),
          ]);
        }).pipe(Effect.provide(NodeServices.layer))
      )
  );

  it.live("releases its claim without masking an export failure", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: "/tmp",
          prefix: "runtime-producer-failure-",
        });
        const fetcher = vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(
            jsonResponse({ expiresAt: Date.now() + 60_000, kind: "claimed" })
          )
          .mockResolvedValueOnce(jsonResponse({ code: "internal" }, 500));
        const exporter = vi.fn<typeof exportSignedRuntime>(() =>
          Effect.fail(contentRuntimeCiError("export failed"))
        );

        expect(
          yield* produceRuntimeArchive(
            config(runnerTemp),
            fetcher,
            exporter
          ).pipe(Effect.flip)
        ).toMatchObject({ message: "export failed" });
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(String(fetcher.mock.calls[1]?.[0])).toContain(
          "/archive/release"
        );
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );

  it.live(
    "does not upload when another run stores the archive during export",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
            directory: "/tmp",
            prefix: "runtime-producer-converged-",
          });
          const exporter = vi.fn<typeof exportSignedRuntime>(() =>
            Effect.void.pipe(Effect.as(undefined))
          );
          const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
              jsonResponse({ expiresAt: Date.now() + 60_000, kind: "claimed" })
            )
            .mockResolvedValueOnce(jsonResponse({ kind: "existing", metadata }))
            .mockResolvedValueOnce(jsonResponse({ released: false }));

          expect(
            yield* produceRuntimeArchive(config(runnerTemp), fetcher, exporter)
          ).toEqual({ kind: "unchanged", metadata });
          expect(exporter).toHaveBeenCalledTimes(1);
          expect(fetcher).toHaveBeenCalledTimes(3);
          expect(fetcher.mock.calls.map((call) => String(call[0]))).toEqual([
            expect.stringContaining("/archive/claim"),
            expect.stringContaining("/archive/claim"),
            expect.stringContaining("/archive/release"),
          ]);
        }).pipe(Effect.provide(NodeServices.layer))
      )
  );

  it.live("stops before upload when its lease changes during export", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: "/tmp",
          prefix: "runtime-producer-lease-change-",
        });
        const exporter = vi.fn<typeof exportSignedRuntime>(() =>
          Effect.void.pipe(Effect.as(undefined))
        );
        const fetcher = vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(
            jsonResponse({ expiresAt: Date.now() + 60_000, kind: "claimed" })
          )
          .mockResolvedValueOnce(
            jsonResponse({ expiresAt: Date.now() + 60_000, kind: "busy" })
          )
          .mockResolvedValueOnce(jsonResponse({ released: false }));

        expect(
          yield* produceRuntimeArchive(
            config(runnerTemp),
            fetcher,
            exporter
          ).pipe(Effect.flip)
        ).toMatchObject({
          message:
            "Immutable signed runtime archive lease changed during export.",
        });
        expect(exporter).toHaveBeenCalledTimes(1);
        expect(fetcher).toHaveBeenCalledTimes(3);
        expect(fetcher.mock.calls.map((call) => String(call[0]))).toEqual([
          expect.stringContaining("/archive/claim"),
          expect.stringContaining("/archive/claim"),
          expect.stringContaining("/archive/release"),
        ]);
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );
});
