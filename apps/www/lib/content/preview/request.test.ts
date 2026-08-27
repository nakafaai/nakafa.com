// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { SigningKeyIdSchema } from "@nakafa/aksara-contracts/ids";
import { Deferred, Effect, Fiber, Redacted } from "effect";
import { TestClock } from "effect/testing";
import { vi } from "vitest";
import type { PreviewConfig } from "@/lib/content/preview/config";
import {
  fetchPreviewJson,
  fetchPreviewJsonForPrerender,
  MAX_PREVIEW_MANIFEST_BYTES,
} from "@/lib/content/preview/request";

const target = "http://127.0.0.1:4000/v1/manifest";
const config: PreviewConfig = {
  eventsPath: "/v1/events",
  keyId: SigningKeyIdSchema.make("local-preview"),
  manifestPath: "/v1/manifest",
  origin: new URL("http://127.0.0.1:4000/"),
  publicKey: "test-public-key",
  token: Redacted.make("secret-token"),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Builds one response whose final URL matches the Fetch contract. */
function response(
  body: BodyInit | null,
  options?: ResponseInit & { readonly url?: string }
) {
  const value = new Response(body, options);
  Object.defineProperty(value, "url", {
    value: options?.url ?? target,
  });
  return value;
}

/** Builds one preview fetch for the Effect test runtime. */
function run(maxBytes = MAX_PREVIEW_MANIFEST_BYTES) {
  return fetchPreviewJson(config, config.manifestPath, maxBytes);
}

/** Returns one typed request failure without losing its error channel. */
function runFailure(
  maxBytes = MAX_PREVIEW_MANIFEST_BYTES,
  path: string = config.manifestPath
) {
  return fetchPreviewJson(config, path, maxBytes).pipe(Effect.flip);
}

describe("local preview JSON requests", () => {
  it.effect("sends a private bearer request and decodes bounded JSON", () =>
    Effect.gen(function* () {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        response('{"status":"ready"}', {
          headers: { "content-type": "application/json; charset=utf-8" },
          status: 200,
        })
      );
      vi.stubGlobal("fetch", fetcher);

      expect(yield* run()).toEqual({ status: "ready" });
      expect(fetcher).toHaveBeenCalledWith(
        new URL(target),
        expect.objectContaining({
          cache: "no-store",
          credentials: "omit",
          headers: {
            accept: "application/json",
            authorization: "Bearer secret-token",
          },
          redirect: "error",
          referrerPolicy: "no-referrer",
        })
      );
    })
  );

  it.effect("maps connection failures without exposing their cause", () =>
    Effect.gen(function* () {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockRejectedValue(new TypeError("secret"))
      );
      expect(yield* runFailure()).toMatchObject({
        _tag: "PreviewRequestError",
        stage: "connect",
      });
    })
  );

  it.effect.each([
    "//attacker.test/steal",
    "/v1/artifacts/%2e%2e%2fmanifest",
    `/v1/artifacts/sha256%3a${"a".repeat(64)}`,
  ])("rejects non-contract path %s before sending its bearer token", (path) =>
    Effect.gen(function* () {
      const fetcher = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", fetcher);

      expect(yield* runFailure(MAX_PREVIEW_MANIFEST_BYTES, path)).toMatchObject(
        { _tag: "PreviewConfigError" }
      );
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it("rejects an invalid path at the Next prerender boundary", () =>
    expect(
      fetchPreviewJsonForPrerender(
        config,
        "//attacker.test/steal",
        MAX_PREVIEW_MANIFEST_BYTES
      )
    ).rejects.toMatchObject({ _tag: "PreviewConfigError" }));

  it.effect(
    "sends the bearer token only to an exact content-addressed artifact",
    () =>
      Effect.gen(function* () {
        const artifactPath = `/v1/artifacts/sha256%3A${"a".repeat(64)}`;
        const artifactTarget = `http://127.0.0.1:4000${artifactPath}`;
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
          response("{}", {
            headers: { "content-type": "application/json" },
            status: 200,
            url: artifactTarget,
          })
        );
        vi.stubGlobal("fetch", fetcher);

        expect(yield* fetchPreviewJson(config, artifactPath, 1024)).toEqual({});
        expect(fetcher).toHaveBeenCalledWith(
          new URL(artifactTarget),
          expect.objectContaining({
            credentials: "omit",
            headers: expect.objectContaining({
              authorization: "Bearer secret-token",
            }),
            redirect: "error",
            referrerPolicy: "no-referrer",
          })
        );
      })
  );

  it.effect.each([
    ["status", response("{}", { status: 409 })],
    [
      "redirected URL",
      response("{}", {
        headers: { "content-type": "application/json" },
        status: 200,
        url: "http://127.0.0.1:4000/elsewhere",
      }),
    ],
    [
      "missing content type",
      response(new TextEncoder().encode("{}"), { status: 200 }),
    ],
    [
      "non-JSON content type",
      response("{}", {
        headers: { "content-type": "application/json-seq" },
        status: 200,
      }),
    ],
  ] as const)("rejects an invalid %s response", ([_label, value]) =>
    Effect.gen(function* () {
      vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(value));
      expect(yield* runFailure()).toMatchObject({
        _tag: "PreviewRequestError",
        stage: "response",
        status: value.status,
      });
    })
  );

  it.effect.each([false, true])(
    "cancels an unread invalid response even when cancellation rejects: %s",
    (rejectCancellation) =>
      Effect.gen(function* () {
        const cancel = vi.fn(() => {
          if (rejectCancellation) {
            return Promise.reject(new TypeError("cancel failed"));
          }
        });
        const invalid = response(new ReadableStream({ cancel }), {
          status: 409,
        });
        vi.stubGlobal(
          "fetch",
          vi.fn<typeof fetch>().mockResolvedValue(invalid)
        );

        expect(yield* runFailure()).toMatchObject({
          _tag: "PreviewRequestError",
          stage: "response",
          status: 409,
        });
        expect(cancel).toHaveBeenCalledOnce();
      })
  );

  it.effect("rejects a response without a body", () =>
    Effect.gen(function* () {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockResolvedValue(
          response(null, {
            headers: { "content-type": "application/json" },
            status: 200,
          })
        )
      );
      expect(yield* runFailure()).toMatchObject({
        _tag: "PreviewRequestError",
        stage: "body",
      });
    })
  );

  it.effect("cancels a response that crosses its byte ceiling", () =>
    Effect.gen(function* () {
      const cancel = vi.fn(() =>
        Promise.reject(new TypeError("cancel failed"))
      );
      const oversized = new ReadableStream<Uint8Array>({
        cancel,
        /** Emits one oversized chunk before provider cancellation. */
        pull(controller) {
          controller.enqueue(new TextEncoder().encode("oversized"));
        },
      });
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          response('{"value":"too large"}', {
            headers: { "content-type": "application/json" },
            status: 200,
          })
        )
        .mockResolvedValueOnce(
          response(oversized, {
            headers: { "content-type": "application/json" },
            status: 200,
          })
        );
      vi.stubGlobal("fetch", fetcher);

      expect(yield* runFailure(4)).toMatchObject({
        _tag: "PreviewBodyLimitError",
        maxBytes: 4,
      });
      expect(yield* runFailure(4)).toMatchObject({
        _tag: "PreviewBodyLimitError",
        maxBytes: 4,
      });
      expect(cancel).toHaveBeenCalledOnce();
    })
  );

  it.effect("maps stream, UTF-8, and JSON decoding failures", () =>
    Effect.gen(function* () {
      const stream = new ReadableStream({
        /** Fails before exposing provider bytes. */
        pull(controller) {
          controller.error(new TypeError("stream failed"));
        },
      });
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(
            response(stream, {
              headers: { "content-type": "application/json" },
              status: 200,
            })
          )
          .mockResolvedValueOnce(
            response(new Uint8Array([255]), {
              headers: { "content-type": "application/json" },
              status: 200,
            })
          )
          .mockResolvedValueOnce(
            response("not-json", {
              headers: { "content-type": "application/json" },
              status: 200,
            })
          )
      );

      expect(yield* runFailure()).toMatchObject({ stage: "body" });
      expect(yield* runFailure()).toMatchObject({ stage: "body" });
      expect(yield* runFailure()).toMatchObject({ stage: "body" });
    })
  );

  it.effect("maps synchronous stream-reader acquisition failures", () =>
    Effect.gen(function* () {
      const unreadable = new ReadableStream<Uint8Array>();
      Object.defineProperty(unreadable, "getReader", {
        /** Fails after response validation but before the first body pull. */
        value() {
          throw new TypeError("reader unavailable");
        },
      });
      const value = response("{}", {
        headers: { "content-type": "application/json" },
        status: 200,
      });
      Object.defineProperty(value, "body", { value: unreadable });
      vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(value));

      expect(yield* runFailure()).toMatchObject({
        _tag: "PreviewRequestError",
        stage: "body",
      });
    })
  );

  it.effect("classifies and cancels a stalled response body", () =>
    Effect.gen(function* () {
      const pullStarted = yield* Deferred.make<void>();
      const cancel = vi.fn();
      const stalled = new ReadableStream<Uint8Array>({
        cancel,
        /** Marks the body phase active without completing its first read. */
        pull() {
          Deferred.doneUnsafe(pullStarted, Effect.void);
        },
      });
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockResolvedValue(
          response(stalled, {
            headers: { "content-type": "application/json" },
            status: 200,
          })
        )
      );
      const fiber = yield* runFailure().pipe(
        Effect.forkChild({ startImmediately: true })
      );

      yield* Deferred.await(pullStarted);
      yield* TestClock.adjust("1 hour");

      expect(yield* Fiber.join(fiber)).toMatchObject({
        _tag: "PreviewRequestError",
        stage: "body",
      });
      expect(cancel).toHaveBeenCalledOnce();
    })
  );

  it.effect("interrupts a stalled request at its typed timeout", () =>
    Effect.gen(function* () {
      /** Keeps Fetch pending until Effect interrupts its AbortSignal. */
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementation(() => new Promise<Response>(() => undefined));
      vi.stubGlobal("fetch", fetcher);
      const fiber = yield* runFailure().pipe(
        Effect.forkChild({ startImmediately: true })
      );

      yield* Effect.yieldNow;
      yield* TestClock.adjust("1 hour");

      expect(yield* Fiber.join(fiber)).toMatchObject({
        _tag: "PreviewRequestError",
        stage: "connect",
      });
      expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    })
  );
});
