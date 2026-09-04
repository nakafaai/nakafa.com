import { describe, expect, it } from "@effect/vitest";
import { MAX_CONTENT_RUNTIME_ARCHIVE_BYTES } from "@repo/backend/content/archive";
import type { RuntimeArchiveWriteConfig } from "@repo/backend/scripts/content/runtime/ci/access";
import { storeRuntimeArchive } from "@repo/backend/scripts/content/runtime/ci/publish";
import { Effect, Redacted } from "effect";

const bytes = new TextEncoder().encode("encrypted-runtime-archive");
const metadata = {
  archiveSha256:
    "e3765fbb7ee79916de02fe557bafe7aa37641457f1c4e8db73e4768b49d61745",
  byteLength: bytes.byteLength,
  contentStateHash: "1".repeat(64),
  createdAt: 1_800_000_000_000,
  runtimeSchemaFingerprint: "2".repeat(64),
};
const claimId = "00000000-0000-4000-8000-000000000001";

function config(): RuntimeArchiveWriteConfig {
  return {
    archiveToken: Redacted.make("technical-archive-token"),
    contentStateHash: metadata.contentStateHash,
    runnerTemp: "/tmp",
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

function oversizedBytes() {
  return new Proxy(new Uint8Array(), {
    get(target, property) {
      if (property === "byteLength") {
        return MAX_CONTENT_RUNTIME_ARCHIVE_BYTES + 1;
      }
      return Reflect.get(target, property, target);
    },
  });
}

describe("content runtime archive publication", () => {
  it.effect(
    "rejects empty and oversized direct inputs before any network call",
    () =>
      Effect.gen(function* () {
        for (const invalid of [new Uint8Array(), oversizedBytes()]) {
          const fetcher = vi.fn<typeof fetch>();
          expect(
            yield* storeRuntimeArchive(
              config(),
              claimId,
              invalid,
              fetcher
            ).pipe(Effect.flip)
          ).toMatchObject({ _tag: "ContentRuntimeCiError" });
          expect(fetcher).not.toHaveBeenCalled();
        }
      })
  );

  it.effect(
    "retries the same uploaded storage identity across transient failures",
    () =>
      Effect.gen(function* () {
        const fetcher = vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(
            jsonResponse({ uploadUrl: "https://upload.example.test/archive" })
          )
          .mockResolvedValueOnce(jsonResponse({ storageId: "storage-1" }))
          .mockRejectedValueOnce(new Error("response lost"))
          .mockResolvedValueOnce(jsonResponse({ code: "internal" }, 503))
          .mockResolvedValueOnce(jsonResponse({ kind: "stored", metadata }));

        expect(
          yield* storeRuntimeArchive(config(), claimId, bytes, fetcher)
        ).toEqual({ kind: "stored", metadata });
        const finalizeBodies = fetcher.mock.calls
          .slice(2)
          .map((call) => call[1]?.body);
        expect(finalizeBodies).toHaveLength(3);
        expect(new Set(finalizeBodies).size).toBe(1);
      })
  );

  it.effect(
    "recovers when finalization committed but every response was lost",
    () =>
      Effect.gen(function* () {
        const fetcher = vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(
            jsonResponse({ uploadUrl: "https://upload.example.test/archive" })
          )
          .mockResolvedValueOnce(jsonResponse({ storageId: "storage-1" }))
          .mockRejectedValueOnce(new Error("response lost"))
          .mockRejectedValueOnce(new Error("response lost"))
          .mockRejectedValueOnce(new Error("response lost"))
          .mockResolvedValueOnce(jsonResponse({ kind: "canonical", metadata }));

        expect(
          yield* storeRuntimeArchive(config(), claimId, bytes, fetcher)
        ).toEqual({ kind: "unchanged", metadata });
        expect(fetcher).toHaveBeenCalledTimes(6);
        expect(String(fetcher.mock.calls[5]?.[0])).toContain("/archive/abort");
      })
  );

  it.effect(
    "returns the terminal finalization failure after bounded cleanup",
    () =>
      Effect.gen(function* () {
        const fetcher = vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(
            jsonResponse({ uploadUrl: "https://upload.example.test/archive" })
          )
          .mockResolvedValueOnce(jsonResponse({ storageId: "storage-1" }))
          .mockResolvedValueOnce(jsonResponse({ code: "conflict" }, 409))
          .mockResolvedValueOnce(jsonResponse({ kind: "deferred" }));

        expect(
          yield* storeRuntimeArchive(config(), claimId, bytes, fetcher).pipe(
            Effect.flip
          )
        ).toMatchObject({
          message: "Runtime archive finalization failed with HTTP 409.",
        });
        expect(fetcher).toHaveBeenCalledTimes(4);

        const unavailable = vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(
            jsonResponse({ uploadUrl: "https://upload.example.test/archive" })
          )
          .mockResolvedValueOnce(jsonResponse({ storageId: "storage-1" }))
          .mockResolvedValueOnce(jsonResponse({ code: "internal" }, 503))
          .mockResolvedValueOnce(jsonResponse({ code: "internal" }, 503))
          .mockResolvedValueOnce(jsonResponse({ code: "internal" }, 503))
          .mockResolvedValueOnce(jsonResponse({ kind: "deleted" }));

        expect(
          yield* storeRuntimeArchive(
            config(),
            claimId,
            bytes,
            unavailable
          ).pipe(Effect.flip)
        ).toMatchObject({
          message: "Runtime archive finalization failed with HTTP 503.",
        });
        expect(unavailable).toHaveBeenCalledTimes(6);
      })
  );

  it.effect(
    "fails closed at each upload boundary without widening retries",
    () =>
      Effect.gen(function* () {
        const capabilityFailure = vi
          .fn<typeof fetch>()
          .mockResolvedValue(jsonResponse({ code: "unauthorized" }, 401));
        expect(
          yield* storeRuntimeArchive(
            config(),
            claimId,
            bytes,
            capabilityFailure
          ).pipe(Effect.flip)
        ).toMatchObject({
          message: "Runtime archive upload capability failed with HTTP 401.",
        });
        expect(capabilityFailure).toHaveBeenCalledTimes(1);

        const storageFailure = vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(
            jsonResponse({ uploadUrl: "https://upload.example.test/archive" })
          )
          .mockResolvedValueOnce(jsonResponse({ code: "unavailable" }, 503));
        expect(
          yield* storeRuntimeArchive(
            config(),
            claimId,
            bytes,
            storageFailure
          ).pipe(Effect.flip)
        ).toMatchObject({
          message: "Runtime archive upload failed with HTTP 503.",
        });
        expect(storageFailure).toHaveBeenCalledTimes(2);

        const cleanupFailure = vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(
            jsonResponse({ uploadUrl: "https://upload.example.test/archive" })
          )
          .mockResolvedValueOnce(jsonResponse({ storageId: "storage-1" }))
          .mockResolvedValueOnce(jsonResponse({ code: "conflict" }, 409))
          .mockResolvedValueOnce(jsonResponse({ code: "internal" }, 500));
        expect(
          yield* storeRuntimeArchive(
            config(),
            claimId,
            bytes,
            cleanupFailure
          ).pipe(Effect.flip)
        ).toMatchObject({
          message: "Runtime archive finalization failed with HTTP 409.",
        });
        expect(cleanupFailure).toHaveBeenCalledTimes(4);
      })
  );
});
