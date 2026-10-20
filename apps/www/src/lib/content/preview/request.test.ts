// @vitest-environment node

import { assert, beforeEach, describe, expect, it } from "@effect/vitest";
import { SigningKeyIdSchema } from "@nakafa/aksara-contracts/ids";
import { Deferred, Effect, Fiber, Redacted, Result } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import type { PreviewConfig } from "@/lib/content/preview/config";
import {
  fetchPreviewJson,
  fetchPreviewJsonForPrerender,
  MAX_PREVIEW_MANIFEST_BYTES,
} from "@/lib/content/preview/request";

const target = "http://127.0.0.1:4000/manifest";
const config: PreviewConfig = {
  eventsPath: "/events",
  keyId: SigningKeyIdSchema.make("local-preview"),
  manifestPath: "/manifest",
  origin: new URL("http://127.0.0.1:4000/"),
  publicKey: "test-public-key",
  token: Redacted.make("secret-token"),
};

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
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
function run(
  maxBytes = MAX_PREVIEW_MANIFEST_BYTES,
  path: string = config.manifestPath
) {
  return fetchPreviewJson(config, path, maxBytes).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

/** Returns one typed request failure without losing its error channel. */
function runFailure(
  maxBytes = MAX_PREVIEW_MANIFEST_BYTES,
  path: string = config.manifestPath
) {
  return Effect.gen(function* () {
    const result = yield* Effect.result(run(maxBytes, path));
    assert(Result.isFailure(result));
    return result.failure;
  });
}

describe("local preview JSON requests", () => {
  it.effect("sends a private bearer request and decodes bounded JSON", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(
        response('{"status":"ready"}', {
          headers: { "content-type": "application/json; charset=utf-8" },
          status: 200,
        })
      );

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
      fetcher.mockRejectedValue(new TypeError("secret"));
      expect(yield* runFailure()).toMatchObject({
        _tag: "PreviewRequestError",
        stage: "connect",
      });
    })
  );

  it.effect.each([
    "//attacker.test/steal",
    "/artifacts/%2e%2e%2fmanifest",
    `/artifacts/sha256%3a${"a".repeat(64)}`,
  ])("rejects non-contract path %s before sending its bearer token", (path) =>
    Effect.gen(function* () {
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
    ).resolves.toMatchObject({
      _tag: "Failure",
      failure: { _tag: "PreviewConfigError" },
    }));

  it.effect(
    "sends the bearer token only to an exact content-addressed artifact",
    () =>
      Effect.gen(function* () {
        const artifactPath = `/artifacts/sha256%3A${"a".repeat(64)}`;
        const artifactTarget = `http://127.0.0.1:4000${artifactPath}`;
        fetcher.mockResolvedValue(
          response("{}", {
            headers: { "content-type": "application/json" },
            status: 200,
            url: artifactTarget,
          })
        );

        expect(yield* run(1024, artifactPath)).toEqual({});
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
      fetcher.mockResolvedValue(value);
      expect(yield* runFailure()).toMatchObject({
        _tag: "PreviewRequestError",
        stage: "response",
        status: value.status,
      });
    })
  );

  it.effect("aborts the request of an invalid response it never reads", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(response("{}", { status: 409 }));

      expect(yield* runFailure()).toMatchObject({
        _tag: "PreviewRequestError",
        stage: "response",
        status: 409,
      });
      expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    })
  );

  it.effect("rejects a response without a body", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(
        response(null, {
          headers: { "content-type": "application/json" },
          status: 200,
        })
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
      fetcher
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
      fetcher
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
        );

      expect(yield* runFailure()).toMatchObject({ stage: "body" });
      expect(yield* runFailure()).toMatchObject({ stage: "body" });
      expect(yield* runFailure()).toMatchObject({ stage: "body" });
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
      fetcher.mockResolvedValue(
        response(stalled, {
          headers: { "content-type": "application/json" },
          status: 200,
        })
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
      fetcher.mockImplementation(() => new Promise<Response>(() => undefined));
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
