import { describe, expect, it } from "@effect/vitest";
import { MAX_CONTENT_RUNTIME_ARCHIVE_CONTROL_RESPONSE_BYTES } from "@repo/backend/content/archive";
import type {
  RuntimeArchiveReadConfig,
  RuntimeArchiveWriteConfig,
} from "@repo/backend/scripts/content/runtime/ci/access";
import {
  claimRuntimeArchive,
  fetchRuntimeArchive,
  releaseRuntimeArchiveClaim,
} from "@repo/backend/scripts/content/runtime/ci/remote";
import { Effect, Option, Redacted } from "effect";

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
const claimId = "00000000-0000-4000-8000-000000000001";

function readConfig(): RuntimeArchiveReadConfig {
  return {
    runnerTemp: "/tmp",
    runtimeSelectionHash: metadata.runtimeSelectionHash,
    runtimeSchemaFingerprint: metadata.runtimeSchemaFingerprint,
    runtimeToken: Redacted.make("technical-runtime-token"),
    siteUrl: "https://production.example.test",
  };
}

function writeConfig(): RuntimeArchiveWriteConfig {
  return {
    archiveToken: Redacted.make("technical-archive-token"),
    runnerTemp: "/tmp",
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

function capability() {
  return jsonResponse({
    ...metadata,
    downloadUrl: "https://storage.example.test/archive",
  });
}

describe("content runtime archive remote boundary", () => {
  it.effect("maps only the exact typed not-found response to absence", () =>
    Effect.gen(function* () {
      const exact = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ code: "CONTENT_RUNTIME_ARCHIVE_NOT_FOUND" }, 404)
        );
      expect(
        Option.isNone(yield* fetchRuntimeArchive(readConfig(), exact))
      ).toBe(true);

      for (const response of [
        jsonResponse({ code: "CONTENT_RUNTIME_ARCHIVE_INVALID" }, 404),
        new Response("gateway missing", { status: 404 }),
        jsonResponse({ code: "CONTENT_RUNTIME_ARCHIVE_NOT_FOUND" }, 500),
      ]) {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
        expect(
          yield* fetchRuntimeArchive(readConfig(), fetcher).pipe(Effect.flip)
        ).toMatchObject({ _tag: "ContentRuntimeCiError" });
      }
    })
  );

  it.effect("fails closed on transport and untrusted control responses", () =>
    Effect.gen(function* () {
      const brokenBody = new Response(
        new ReadableStream({
          type: "bytes",
          pull(controller) {
            controller.error(new Error("body unavailable"));
          },
        }),
        { status: 404 }
      );
      let cancelled = false;
      let largestRead = 0;
      let supplied = 0;
      const oversizedBody = new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
          pull(controller) {
            const request = controller.byobRequest;
            if (!request) {
              controller.error(new Error("Expected a bounded byte request."));
              return;
            }
            const view = request.view;
            if (!view) {
              controller.error(new Error("Expected a byte buffer."));
              return;
            }
            largestRead = Math.max(largestRead, view.byteLength);
            const bytes = new Uint8Array(
              view.buffer,
              view.byteOffset,
              view.byteLength
            );
            bytes.fill(120);
            supplied += bytes.byteLength;
            request.respond(bytes.byteLength);
          },
          type: "bytes",
        }),
        { status: 404 }
      );
      const responses = [
        brokenBody,
        oversizedBody,
        new Response(null, { status: 404 }),
        jsonResponse({ downloadUrl: "not-a-url" }),
        jsonResponse({
          ...metadata,
          downloadUrl: "https://storage.example.test/archive",
          sourceStateHash: "invalid\nCONTENT_RUNTIME_STATE_HASH=unsafe",
        }),
      ];
      for (const response of responses) {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
        expect(
          yield* fetchRuntimeArchive(readConfig(), fetcher).pipe(Effect.flip)
        ).toMatchObject({ _tag: "ContentRuntimeCiError" });
      }
      expect(cancelled).toBe(true);
      expect(largestRead).toBeLessThanOrEqual(1024);
      expect(supplied).toBe(
        MAX_CONTENT_RUNTIME_ARCHIVE_CONTROL_RESPONSE_BYTES + 1
      );

      const unreachable = vi
        .fn<typeof fetch>()
        .mockRejectedValue(new Error("network unavailable"));
      expect(
        yield* fetchRuntimeArchive(readConfig(), unreachable).pipe(Effect.flip)
      ).toMatchObject({
        message:
          "Runtime archive download capability could not reach Convex storage.",
      });
    })
  );

  it.effect("rejects every incomplete or oversized download body", () =>
    Effect.gen(function* () {
      const bodyFailure = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(new Error("stream unavailable"));
        },
      });
      const responses = [
        new Response("unavailable", { status: 502 }),
        new Response(bytes, {
          headers: { "content-length": String(bytes.byteLength + 1) },
          status: 200,
        }),
        new Response(null, { status: 200 }),
        new Response(bytes.slice(0, -1), { status: 200 }),
        new Response(new Uint8Array(bytes.byteLength + 1), { status: 200 }),
        new Response(bodyFailure, { status: 200 }),
        new Response(new Uint8Array(bytes.byteLength).fill(1), { status: 200 }),
      ];

      for (const response of responses) {
        const fetcher = vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(capability())
          .mockResolvedValueOnce(response);
        expect(
          yield* fetchRuntimeArchive(readConfig(), fetcher).pipe(Effect.flip)
        ).toMatchObject({ _tag: "ContentRuntimeCiError" });
      }
    })
  );

  it.effect("accepts an exact declared download length", () =>
    Effect.gen(function* () {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(capability())
        .mockResolvedValueOnce(
          new Response(bytes, {
            headers: { "content-length": String(bytes.byteLength) },
            status: 200,
          })
        );
      const result = yield* fetchRuntimeArchive(readConfig(), fetcher);
      expect(Option.isSome(result)).toBe(true);
    })
  );

  it.effect("enforces authenticated metadata size before downloading", () =>
    Effect.gen(function* () {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          ...metadata,
          byteLength: 256 * 1024 * 1024 + 1,
          downloadUrl: "https://storage.example.test/archive",
        })
      );
      expect(
        yield* fetchRuntimeArchive(readConfig(), fetcher).pipe(Effect.flip)
      ).toMatchObject({ _tag: "ContentRuntimeCiError" });
      expect(fetcher).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("surfaces claim and release authorization failures", () =>
    Effect.gen(function* () {
      const claimFetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse({ code: "unauthorized" }, 401));
      const releaseFetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse({ code: "internal" }, 500));

      expect(
        yield* claimRuntimeArchive(writeConfig(), claimId, claimFetcher).pipe(
          Effect.flip
        )
      ).toMatchObject({ _tag: "ContentRuntimeCiError" });
      expect(
        yield* releaseRuntimeArchiveClaim(
          writeConfig(),
          claimId,
          releaseFetcher
        ).pipe(Effect.flip)
      ).toMatchObject({ _tag: "ContentRuntimeCiError" });
    })
  );
});
