import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import {
  CONTENT_RUNTIME_ARCHIVE_EXPORT_TIMEOUT_MS,
  CONTENT_RUNTIME_ARCHIVE_LEASE_MS,
} from "@repo/backend/content/archive";
import type { ProducerConfig } from "@repo/backend/scripts/content/runtime/ci/access";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import { exportSignedRuntime } from "@repo/backend/scripts/content/runtime/ci/export";
import { produceRuntimeArchive } from "@repo/backend/scripts/content/runtime/ci/producer";
import {
  CONTENT_RUNTIME_CACHE_DIRECTORY,
  CONTENT_RUNTIME_CACHE_FILE,
} from "@repo/backend/scripts/content/runtime/ci/snapshot";
import { Effect, Fiber, FileSystem, Redacted } from "effect";
import { TestClock } from "effect/testing";

const MINIMUM_LEASE_SAFETY_MARGIN_MS = 5 * 60 * 1000;
const bytes = new TextEncoder().encode("encrypted-runtime-archive");
const metadata = {
  archiveSha256:
    "e3765fbb7ee79916de02fe557bafe7aa37641457f1c4e8db73e4768b49d61745",
  byteLength: bytes.byteLength,
  createdAt: 1_800_000_000_000,
  runtimeSelectionHash: "1".repeat(64),
  runtimeSchemaFingerprint: "2".repeat(64),
  sourceStateHash: "3".repeat(64),
};

function config(
  runnerTemp: string,
  contentStateHash = metadata.sourceStateHash
): ProducerConfig {
  return {
    archiveToken: Redacted.make("technical-archive-token"),
    cacheKey: Redacted.make("k".repeat(43)),
    contentStateHash,
    deployKey: Redacted.make("production-deploy-key"),
    exportLimit: 100_000,
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

describe("content runtime archive producer", () => {
  it.live("reuses the selection archive after source state drift", () =>
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
          yield* produceRuntimeArchive(
            config(runnerTemp, "9".repeat(64)),
            fetcher,
            exporter
          )
        ).toEqual({ kind: "unchanged", metadata });
        expect(exporter).not.toHaveBeenCalled();
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(
          JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))
        ).toMatchObject({
          runtimeSchemaFingerprint: metadata.runtimeSchemaFingerprint,
          runtimeSelectionHash: metadata.runtimeSelectionHash,
        });
        expect(String(fetcher.mock.calls[0]?.[1]?.body)).not.toContain(
          "contentStateHash"
        );
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );

  it.effect("interrupts export before the producer lease can expire", () =>
    Effect.gen(function* () {
      expect(
        CONTENT_RUNTIME_ARCHIVE_LEASE_MS -
          CONTENT_RUNTIME_ARCHIVE_EXPORT_TIMEOUT_MS
      ).toBeGreaterThanOrEqual(MINIMUM_LEASE_SAFETY_MARGIN_MS);
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          jsonResponse({
            expiresAt: Date.now() + CONTENT_RUNTIME_ARCHIVE_LEASE_MS,
            kind: "claimed",
          })
        )
        .mockResolvedValueOnce(jsonResponse({ released: true }));
      const exporter = vi.fn<typeof exportSignedRuntime>(() => Effect.never);
      const fiber = yield* produceRuntimeArchive(
        config("/tmp"),
        fetcher,
        exporter
      ).pipe(
        Effect.flip,
        Effect.provide(NodeServices.layer),
        Effect.forkChild({ startImmediately: true })
      );

      yield* Effect.yieldNow;
      yield* TestClock.adjust(CONTENT_RUNTIME_ARCHIVE_EXPORT_TIMEOUT_MS);

      expect(yield* Fiber.join(fiber)).toMatchObject({
        message:
          "Signed runtime export exceeded its producer lease safety window.",
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(String(fetcher.mock.calls[1]?.[0])).toContain("/archive/release");
    })
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
