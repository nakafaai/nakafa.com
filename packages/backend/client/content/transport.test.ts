// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ContentTransportError } from "@repo/backend/client/content/errors";
import { createContentContractError } from "@repo/backend/client/content/status";
import {
  readContentResponse,
  requestContentResponse,
} from "@repo/backend/client/content/transport";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PUBLIC_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { Duration, Effect, Fiber } from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/http";
import { TestClock } from "effect/testing";

const endpoint = `https://example.convex.site${PUBLIC_CONTENT_RUNTIME_PATH}`;
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

/** Creates one marked response whose body stream fails after headers. */
function createBrokenBodyResponse() {
  const body = new ReadableStream<Uint8Array>({
    start: (controller) => controller.error(new Error("private body failure")),
  });
  return createResponse(body, 200);
}

/** Creates one unread response whose still-open body reports its release. */
function createOpenResponse(source: string, status: number) {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    cancel,
    start: (controller) => controller.enqueue(new TextEncoder().encode(source)),
  });
  return {
    cancel,
    response: createResponse(body, status, unmarkedJsonHeaders),
  };
}

/** Wraps one web response the way Effect's client hands it to a reader. */
function received(response: Response) {
  return HttpClientResponse.fromWeb(HttpClientRequest.post(endpoint), response);
}

/** Returns the abort signal that one attempt handed to Fetch. */
function attemptSignal(attempt: number) {
  return fetchMock.mock.calls[attempt]?.[1]?.signal;
}

/** Runs a retrying request under Effect's deterministic clock. */
const runRetryRequest = <Value, Error>(
  program: Effect.Effect<Value, Error>,
  seconds = 2
) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(program);
    yield* TestClock.adjust(Duration.seconds(seconds));
    return yield* Fiber.join(fiber);
  });

/** Requests one response without adding a test-only reader behavior. */
const requestResponse = (to = endpoint) =>
  requestContentResponse({ endpoint: to, source: "{}", target }, (response) =>
    Effect.succeed(response)
  ).pipe(Effect.map(({ response }) => response));

/** Requests one response and reads it as bounded JSON. */
const requestJson = () =>
  requestContentResponse({ endpoint, source: "{}", target }, (response, to) =>
    readContentResponse(response, to, 1024)
  );

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("content runtime transport", () => {
  it.live("posts one private no-store request with the server credential", () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(createResponse("{}", 200));

      expect((yield* requestResponse()).status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        new URL(endpoint),
        expect.objectContaining({
          cache: "no-store",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "x-nakafa-content-token": target.token,
          },
          method: "POST",
          redirect: "error",
          signal: expect.any(AbortSignal),
        })
      );
      expect(
        yield* Effect.promise(() =>
          new Response(fetchMock.mock.calls[0]?.[1]?.body).text()
        )
      ).toBe("{}");
    })
  );

  it.effect(
    "shares one retry budget across network and platform failures",
    () =>
      Effect.gen(function* () {
        const platformFailure = createOpenResponse(
          '{"code":"Server Error"}',
          500
        );
        fetchMock
          .mockRejectedValueOnce(createFetchFailure("ECONNRESET"))
          .mockResolvedValueOnce(platformFailure.response)
          .mockResolvedValueOnce(createResponse("{}", 200));

        expect((yield* runRetryRequest(requestResponse())).status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(platformFailure.cancel).toHaveBeenCalledOnce();
      })
  );

  it.effect("retries a read-only request after an interrupted body", () =>
    Effect.gen(function* () {
      fetchMock
        .mockResolvedValueOnce(createBrokenBodyResponse())
        .mockResolvedValueOnce(createResponse('{"kind":"found"}', 200));

      const result = yield* runRetryRequest(requestJson());

      expect(result.value).toEqual({ kind: "found" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("preserves an interrupted body after bounded retries", () =>
    Effect.gen(function* () {
      fetchMock.mockImplementation(() =>
        Promise.resolve(createBrokenBodyResponse())
      );

      const failure = yield* runRetryRequest(requestJson().pipe(Effect.flip));

      expect(failure).toEqual(ContentTransportError.make({ reason: "body" }));
      expect(fetchMock).toHaveBeenCalledTimes(3);
    })
  );

  it.effect("does not retry a terminal reader failure", () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(createResponse("{", 200));

      expect(yield* runRetryRequest(requestJson().pipe(Effect.flip))).toEqual(
        ContentTransportError.make({ reason: "json-syntax" })
      );
      expect(fetchMock).toHaveBeenCalledOnce();
    })
  );

  it.effect("cancels only discarded unmarked platform responses", () =>
    Effect.gen(function* () {
      const first = createOpenResponse("first", 500);
      const second = createOpenResponse("second", 500);
      fetchMock
        .mockResolvedValueOnce(first.response)
        .mockResolvedValueOnce(second.response)
        .mockResolvedValueOnce(createResponse("success", 200));

      const response = yield* runRetryRequest(requestResponse());

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(first.cancel).toHaveBeenCalledOnce();
      expect(second.cancel).toHaveBeenCalledOnce();
      expect(attemptSignal(0)?.aborted).toBe(true);
      expect(attemptSignal(1)?.aborted).toBe(true);
      expect(attemptSignal(2)?.aborted).toBe(false);
      expect(yield* response.text).toBe("success");
    })
  );

  it.effect(
    "returns the final unmarked response untouched after exhaustion",
    () =>
      Effect.gen(function* () {
        const final = '{"code":"[Request ID: private] Server Error"}';
        fetchMock
          .mockResolvedValueOnce(createOpenResponse("first", 500).response)
          .mockResolvedValueOnce(createOpenResponse("second", 500).response)
          .mockResolvedValueOnce(
            createResponse(final, 500, unmarkedJsonHeaders)
          );

        const response = yield* runRetryRequest(requestResponse());

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(attemptSignal(2)?.aborted).toBe(false);
        expect(yield* readContentResponse(response, endpoint, 1024)).toEqual({
          code: "[Request ID: private] Server Error",
        });
        expect(createContentContractError(response)).toEqual(
          ContentTransportError.make({ reason: "response-unmarked" })
        );
      })
  );

  it.live("keeps other received responses on one attempt", () =>
    Effect.gen(function* () {
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
        createResponse(null, 500, {}),
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

        expect((yield* requestResponse()).status).toBe(response.status);
        expect(fetchMock).toHaveBeenCalledOnce();
      }
    })
  );

  it.effect("retries an unmarked platform response without a body", () =>
    Effect.gen(function* () {
      fetchMock
        .mockResolvedValueOnce(createResponse(null, 500, unmarkedJsonHeaders))
        .mockResolvedValueOnce(createResponse("success", 200));

      expect((yield* runRetryRequest(requestResponse())).status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("preserves sanitized codes after bounded retries", () =>
    Effect.gen(function* () {
      fetchMock.mockRejectedValue(createFetchFailure("EPIPE"));

      expect(
        yield* runRetryRequest(requestResponse().pipe(Effect.flip))
      ).toEqual(
        ContentTransportError.make({
          networkCodes: ["EPIPE"],
          reason: "fetch",
        })
      );
      expect(fetchMock).toHaveBeenCalledTimes(3);
    })
  );

  it.live("does not retry unknown or timeout fetch failures", () =>
    Effect.gen(function* () {
      fetchMock.mockRejectedValue(
        createFetchFailure("UND_ERR_CONNECT_TIMEOUT")
      );

      expect(yield* requestResponse().pipe(Effect.flip)).toEqual(
        ContentTransportError.make({ networkCodes: [], reason: "fetch" })
      );
      expect(fetchMock).toHaveBeenCalledOnce();
    })
  );

  it.live("fails without a request when its endpoint is not a URL", () =>
    Effect.gen(function* () {
      expect(yield* requestResponse("not a URL").pipe(Effect.flip)).toEqual(
        ContentTransportError.make({ networkCodes: [], reason: "fetch" })
      );
      expect(fetchMock).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "fails a read after three attempts miss their request deadline",
    () =>
      Effect.gen(function* () {
        fetchMock.mockImplementation(
          () => new Promise<Response>(() => undefined)
        );

        // Three attempts of ten seconds, with the 500 ms and 1 s delays between them.
        expect(
          yield* runRetryRequest(requestResponse().pipe(Effect.flip), 31.5)
        ).toEqual(
          ContentTransportError.make({ networkCodes: [], reason: "fetch" })
        );
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(attemptSignal(0)?.aborted).toBe(true);
        expect(attemptSignal(1)?.aborted).toBe(true);
        expect(attemptSignal(2)?.aborted).toBe(true);
      })
  );

  it.effect(
    "answers a read whose first attempt misses its request deadline",
    () =>
      Effect.gen(function* () {
        fetchMock
          .mockImplementationOnce(() => new Promise<Response>(() => undefined))
          .mockResolvedValueOnce(createResponse("{}", 200));

        expect((yield* runRetryRequest(requestResponse(), 11)).status).toBe(
          200
        );
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(attemptSignal(0)?.aborted).toBe(true);
      })
  );

  it.effect("keeps an unknown network code final after a missed deadline", () =>
    Effect.gen(function* () {
      fetchMock
        .mockImplementationOnce(() => new Promise<Response>(() => undefined))
        .mockRejectedValueOnce(createFetchFailure("UND_ERR_CONNECT_TIMEOUT"));

      expect(
        yield* runRetryRequest(requestResponse().pipe(Effect.flip), 11)
      ).toEqual(
        ContentTransportError.make({ networkCodes: [], reason: "fetch" })
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    })
  );

  it.effect.each([
    ["a marked response", 200, undefined],
    ["the final unmarked response", 500, unmarkedJsonHeaders],
  ] as const)(
    "counts a stalled body of %s as interrupted at its deadline",
    ([_label, status, headers]) =>
      Effect.gen(function* () {
        const body = () => new ReadableStream<Uint8Array>();
        fetchMock.mockImplementation(() =>
          Promise.resolve(createResponse(body(), status, headers))
        );

        // Three attempts of ten seconds each, with both retry delays between them.
        expect(
          yield* runRetryRequest(requestJson().pipe(Effect.flip), 32)
        ).toEqual(ContentTransportError.make({ reason: "body" }));
        expect(fetchMock).toHaveBeenCalledTimes(3);
      })
  );

  it.live("reads exact bounded JSON and rejects untrusted responses", () =>
    Effect.gen(function* () {
      expect(
        yield* readContentResponse(
          received(createResponse('{"kind":"missing"}', 404)),
          endpoint,
          1024
        )
      ).toEqual({ kind: "missing" });
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
          createResponse(null, 200, {
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
        [createResponse(new Uint8Array([0xc3, 0x28]), 200), "body"],
        [createResponse("x".repeat(20), 200), "response-size"],
      ];
      for (const [response, reason] of invalid) {
        expect(
          yield* readContentResponse(received(response), endpoint, 10).pipe(
            Effect.flip
          )
        ).toMatchObject({ reason });
      }
    })
  );
});
