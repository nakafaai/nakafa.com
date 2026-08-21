// @vitest-environment node

import { ContentTransportError } from "@repo/backend/client/content/errors";
import {
  createContentContractError,
  createContentEndpoint,
  encodeContentRequest,
  postContentRequest,
  readContentResponse,
  validateContentRuntimeStatus,
} from "@repo/backend/client/content/transport";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PUBLIC_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { describe, expect, it } from "@repo/testing/effect";
import { Duration, Effect, Fiber, Logger } from "effect";
import { TestClock } from "effect/testing";
import { afterEach, beforeEach, vi } from "vitest";

const endpoint = "https://example.convex.site/internal/content/runtime";
const target = {
  siteUrl: "https://example.convex.site",
  token: "runtime-test-token",
};
const unmarkedJsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};
const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());

/** Creates the nested rejection shape produced by Node fetch. */
function createFetchFailure(code?: string) {
  const cause = code
    ? Object.assign(new Error("private network detail"), { code })
    : new Error("private network detail");
  return new TypeError("fetch failed", { cause });
}

vi.mock("server-only", () => ({}));

/** Creates one response with the immutable network URL populated. */
function createResponse(
  body: BodyInit | null,
  status: number,
  headers: HeadersInit = {
    "content-type": "application/json; charset=utf-8",
    [CONTENT_RUNTIME_RESPONSE_HEADER]: CONTENT_RUNTIME_RESPONSE_MARKER,
  },
  url = endpoint
) {
  const response = new Response(body, { headers, status });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

/** Observes cancellation of one concrete response body. */
function observeResponseCancel(response: Response) {
  const body = response.body;
  if (body === null) {
    return expect.fail("Expected the test response to have a body.");
  }
  return vi.spyOn(body, "cancel");
}

/** Runs a retrying request under Effect's deterministic clock. */
const runRetryRequest = <Value, Error>(program: Effect.Effect<Value, Error>) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(program);
    yield* TestClock.adjust(Duration.seconds(2));
    return yield* Fiber.join(fiber);
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("content runtime transport", () => {
  it("builds only fixed HTTPS or loopback endpoints", async () => {
    await expect(
      Effect.runPromise(
        createContentEndpoint(
          "https://example.convex.site/ignored",
          PUBLIC_CONTENT_RUNTIME_PATH
        )
      )
    ).resolves.toBe(endpoint);
    await expect(
      Effect.runPromise(
        createContentEndpoint(
          "http://localhost:3211/ignored",
          PUBLIC_CONTENT_RUNTIME_PATH
        )
      )
    ).resolves.toBe("http://localhost:3211/internal/content/runtime");

    for (const siteUrl of [
      "not a URL",
      "http://example.com",
      "ftp://localhost",
      "https://user:secret@example.com",
    ]) {
      await expect(
        Effect.runPromise(
          createContentEndpoint(siteUrl, PUBLIC_CONTENT_RUNTIME_PATH).pipe(
            Effect.flip
          )
        )
      ).resolves.toEqual(new ContentTransportError({ reason: "url" }));
    }
  });

  it("serializes bounded request JSON and rejects invalid values", async () => {
    await expect(
      Effect.runPromise(encodeContentRequest({ locale: "en" }, 1024))
    ).resolves.toBe('{"locale":"en"}');
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    await expect(
      Effect.runPromise(encodeContentRequest(cyclic, 1024).pipe(Effect.flip))
    ).resolves.toMatchObject({ reason: "request" });
    await expect(
      Effect.runPromise(
        encodeContentRequest({ value: "x".repeat(1024) }, 10).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ reason: "request-size" });
  });

  it("posts one private no-store request with the server credential", async () => {
    const response = createResponse("{}", 200);
    fetchMock.mockResolvedValue(response);

    await expect(
      Effect.runPromise(postContentRequest({ endpoint, source: "{}", target }))
    ).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        body: "{}",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-nakafa-content-token": target.token,
        },
        method: "POST",
        redirect: "error",
        signal: expect.any(AbortSignal),
      })
    );
  });

  it.effect(
    "shares one retry budget across network and platform failures",
    () =>
      Effect.gen(function* () {
        const platformFailure = createResponse(
          '{"code":"Server Error"}',
          500,
          unmarkedJsonHeaders
        );
        const cancelPlatformFailure = observeResponseCancel(platformFailure);
        const response = createResponse("{}", 200);
        fetchMock
          .mockRejectedValueOnce(createFetchFailure("ECONNRESET"))
          .mockResolvedValueOnce(platformFailure)
          .mockResolvedValueOnce(response);

        expect(
          yield* runRetryRequest(
            postContentRequest({ endpoint, source: "{}", target })
          )
        ).toBe(response);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(cancelPlatformFailure).toHaveBeenCalledOnce();
      })
  );

  it.effect("cancels only discarded unmarked platform responses", () =>
    Effect.gen(function* () {
      const first = createResponse("first", 500, unmarkedJsonHeaders);
      const second = createResponse("second", 500, unmarkedJsonHeaders);
      const success = createResponse("success", 200);
      const cancelFirst = observeResponseCancel(first);
      const cancelSecond = observeResponseCancel(second);
      const cancelSuccess = observeResponseCancel(success);
      fetchMock
        .mockResolvedValueOnce(first)
        .mockResolvedValueOnce(second)
        .mockResolvedValueOnce(success);

      expect(
        yield* runRetryRequest(
          postContentRequest({ endpoint, source: "{}", target })
        )
      ).toBe(success);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(cancelFirst).toHaveBeenCalledOnce();
      expect(cancelSecond).toHaveBeenCalledOnce();
      expect(cancelSuccess).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "returns the final unmarked response untouched after exhaustion",
    () =>
      Effect.gen(function* () {
        const first = createResponse("first", 500, unmarkedJsonHeaders);
        const second = createResponse("second", 500, unmarkedJsonHeaders);
        const final = createResponse(
          '{"code":"[Request ID: private] Server Error"}',
          500,
          unmarkedJsonHeaders
        );
        const cancelFirst = observeResponseCancel(first);
        const cancelSecond = observeResponseCancel(second);
        const cancelFinal = observeResponseCancel(final);
        fetchMock
          .mockResolvedValueOnce(first)
          .mockResolvedValueOnce(second)
          .mockResolvedValueOnce(final);

        const response = yield* runRetryRequest(
          postContentRequest({ endpoint, source: "{}", target })
        );

        expect(response).toBe(final);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(cancelFirst).toHaveBeenCalledOnce();
        expect(cancelSecond).toHaveBeenCalledOnce();
        expect(cancelFinal).not.toHaveBeenCalled();
        expect(yield* readContentResponse(response, endpoint, 1024)).toEqual({
          code: "[Request ID: private] Server Error",
        });
        expect(createContentContractError(response)).toEqual(
          new ContentTransportError({ reason: "response-unmarked" })
        );
      })
  );

  it("keeps other received responses on one attempt", async () => {
    const responses = [
      createResponse("{}", 200, unmarkedJsonHeaders),
      createResponse("{}", 401, unmarkedJsonHeaders),
      createResponse("{}", 404, unmarkedJsonHeaders),
      createResponse("{}", 502, unmarkedJsonHeaders),
      createResponse("{}", 503, unmarkedJsonHeaders),
      createResponse("{}", 500),
      createResponse("{}", 500, {
        "content-type": "application/json",
        [CONTENT_RUNTIME_RESPONSE_HEADER]: "wrong-marker",
      }),
      createResponse("{}", 500, { "content-type": "text/plain" }),
      createResponse(
        "{}",
        500,
        unmarkedJsonHeaders,
        "https://other.test/internal/content/runtime"
      ),
    ];

    for (const response of responses) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(response);

      await expect(
        Effect.runPromise(
          postContentRequest({ endpoint, source: "{}", target })
        )
      ).resolves.toBe(response);
      expect(fetchMock).toHaveBeenCalledOnce();
    }
  });

  it.effect("continues when a discarded response body cannot be canceled", () =>
    Effect.gen(function* () {
      const messages: unknown[] = [];
      const logger = Logger.make(({ message }) => messages.push(message));
      const platformFailure = createResponse(
        "failure",
        500,
        unmarkedJsonHeaders
      );
      const cancelPlatformFailure = observeResponseCancel(platformFailure);
      cancelPlatformFailure.mockRejectedValueOnce(new Error("private detail"));
      const success = createResponse("success", 200);
      fetchMock
        .mockResolvedValueOnce(platformFailure)
        .mockResolvedValueOnce(success);
      const request = postContentRequest({
        endpoint,
        source: "{}",
        target,
      }).pipe(Effect.provide(Logger.layer([logger])));

      expect(yield* runRetryRequest(request)).toBe(success);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(messages).toEqual([
        ["Unable to cancel a discarded content runtime response body."],
      ]);
    })
  );

  it.effect("retries an unmarked platform response without a body", () =>
    Effect.gen(function* () {
      const success = createResponse("success", 200);
      fetchMock
        .mockResolvedValueOnce(createResponse(null, 500, unmarkedJsonHeaders))
        .mockResolvedValueOnce(success);

      expect(
        yield* runRetryRequest(
          postContentRequest({ endpoint, source: "{}", target })
        )
      ).toBe(success);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("preserves sanitized codes after bounded retries", () =>
    Effect.gen(function* () {
      fetchMock.mockRejectedValue(createFetchFailure("EPIPE"));

      expect(
        yield* runRetryRequest(
          postContentRequest({ endpoint, source: "{}", target }).pipe(
            Effect.flip
          )
        )
      ).toEqual(
        new ContentTransportError({
          networkCodes: ["EPIPE"],
          reason: "fetch",
        })
      );
      expect(fetchMock).toHaveBeenCalledTimes(3);
    })
  );

  it("does not retry unknown or timeout fetch failures", async () => {
    fetchMock.mockRejectedValue(createFetchFailure("UND_ERR_CONNECT_TIMEOUT"));

    await expect(
      Effect.runPromise(
        postContentRequest({ endpoint, source: "{}", target }).pipe(Effect.flip)
      )
    ).resolves.toEqual(
      new ContentTransportError({ networkCodes: [], reason: "fetch" })
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("reads exact bounded JSON and rejects untrusted responses", async () => {
    await expect(
      Effect.runPromise(
        readContentResponse(
          createResponse('{"kind":"missing"}', 404),
          endpoint,
          1024
        )
      )
    ).resolves.toEqual({ kind: "missing" });
    expect(createContentContractError(createResponse("{}", 200))).toEqual(
      new ContentTransportError({ reason: "response-contract" })
    );
    expect(
      createContentContractError(
        createResponse("{}", 200, { "content-type": "application/json" })
      )
    ).toEqual(new ContentTransportError({ reason: "response-unmarked" }));

    const invalid: readonly [Response, string][] = [
      [
        createResponse("{}", 200, undefined, "https://other.test"),
        "response-url",
      ],
      [
        createResponse("{}", 200, {
          "content-type": "text/plain",
          [CONTENT_RUNTIME_RESPONSE_HEADER]: CONTENT_RUNTIME_RESPONSE_MARKER,
        }),
        "content-type",
      ],
      [
        createResponse("{}", 200, {
          "content-length": "invalid",
          "content-type": "application/json",
          [CONTENT_RUNTIME_RESPONSE_HEADER]: CONTENT_RUNTIME_RESPONSE_MARKER,
        }),
        "content-length",
      ],
      [
        createResponse("{", 200, { "content-type": "application/json" }),
        "response-unmarked",
      ],
      [createResponse("{", 200), "json-syntax"],
      [createResponse("x".repeat(20), 200), "response-size"],
    ];
    for (const [response, reason] of invalid) {
      await expect(
        Effect.runPromise(
          readContentResponse(response, endpoint, 10).pipe(Effect.flip)
        )
      ).resolves.toMatchObject({ reason });
    }
  });

  it("accepts only contract-owned response status pairs", async () => {
    for (const [response, status] of [
      [{ kind: "found" }, 200],
      [{ kind: "missing" }, 404],
      [{ code: "CONTENT_RUNTIME_UNAUTHORIZED", kind: "failure" }, 401],
      [{ code: "CONTENT_RUNTIME_INVALID", kind: "failure" }, 413],
      [{ code: "CONTENT_RUNTIME_INTERNAL", kind: "failure" }, 500],
      [{ code: "CONTENT_RUNTIME_RESPONSE_TOO_LARGE", kind: "failure" }, 500],
    ] as const) {
      await expect(
        Effect.runPromise(validateContentRuntimeStatus(response, status))
      ).resolves.toBeUndefined();
    }
    await expect(
      Effect.runPromise(
        validateContentRuntimeStatus({ kind: "missing" }, 200).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ reason: "status" });
  });
});
