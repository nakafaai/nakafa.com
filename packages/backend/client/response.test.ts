// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  ConvexRuntimeQueryError,
  readConvexRuntimeQuery,
} from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { vi } from "vitest";

const clientState = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    private readonly fetchHook: typeof fetch | undefined;

    /** Retains the configured fetch hook for response-boundary tests. */
    constructor(
      _url: string,
      options: {
        fetch?: typeof fetch;
      }
    ) {
      this.fetchHook = options.fetch;
    }

    /** Delegates query behavior to the test-owned response seam. */
    query(query: unknown, args: unknown) {
      return clientState.query(this.fetchHook, query, args);
    }
  },
}));

const query = api.contentRelease.reference.read;
const args: FunctionArgs<typeof query> = {
  input: {
    appLocale: "en",
    kind: "route",
    publicPath: "articles/example",
  },
};
const queryName = "contentRelease/reference:read";
const runtimeUrl = "https://example.convex.cloud";

function transientResponse(status: number, cancel = vi.fn()) {
  return {
    cancel,
    response: new Response(new ReadableStream({ cancel }), { status }),
  };
}

function queryThroughFetch(result: unknown = null) {
  clientState.query.mockImplementation(
    async (fetchHook: typeof fetch | undefined) => {
      if (!fetchHook) {
        throw new Error("Expected Convex runtime fetch hook.");
      }

      await fetchHook("https://runtime.example/api/query");
      return result;
    }
  );
}

function queryThroughTerminalResponse(status: number, failure: Error) {
  clientState.query.mockImplementation(
    async (fetchHook: typeof fetch | undefined) => {
      if (!fetchHook) {
        throw new Error("Expected Convex runtime fetch hook.");
      }

      await fetchHook("https://runtime.example/api/query");
      throw failure;
    }
  );
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private failure", { status }))
  );
}

afterEach(() => {
  clientState.query.mockReset();
  vi.unstubAllGlobals();
});

describe("Convex runtime responses", () => {
  it.effect("retries transient HTTP responses", () => {
    const overloaded = transientResponse(503);
    const failed = transientResponse(500);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(overloaded.response)
      .mockResolvedValueOnce(failed.response)
      .mockResolvedValueOnce(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    queryThroughFetch(42);

    return Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        readConvexRuntimeQuery(runtimeUrl, query, args)
      );
      yield* TestClock.adjust(Duration.millis(1500));

      expect(yield* Fiber.join(fiber)).toBe(42);
      expect(clientState.query).toHaveBeenCalledTimes(3);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(overloaded.cancel).toHaveBeenCalledOnce();
      expect(failed.cancel).toHaveBeenCalledOnce();
    });
  });

  it.effect("preserves retries when response cleanup cannot complete", () => {
    const cancel = vi.fn(() => Promise.reject(new Error("cancel failed")));
    const failed = transientResponse(503, cancel);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(failed.response)
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    queryThroughFetch(42);

    return Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        readConvexRuntimeQuery(runtimeUrl, query, args)
      );
      yield* TestClock.adjust(Duration.millis(1500));

      expect(yield* Fiber.join(fiber)).toBe(42);
      expect(cancel).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  it.effect("preserves sanitized status after retry exhaustion", () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private overload", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    queryThroughFetch();

    return Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        readConvexRuntimeQuery(runtimeUrl, query, args).pipe(Effect.flip)
      );
      yield* TestClock.adjust(Duration.millis(1500));
      const result = yield* Fiber.join(fiber);

      expect(result).toEqual(
        new ConvexRuntimeQueryError({
          httpStatuses: [503],
          networkCodes: [],
          query: queryName,
          reason: "transport",
        })
      );
      expect(clientState.query).toHaveBeenCalledTimes(3);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(JSON.stringify(result)).not.toContain("private overload");
    });
  });

  it.effect("keeps function failures terminal", () => {
    queryThroughTerminalResponse(
      560,
      new ConvexError("public function failure")
    );

    return Effect.gen(function* () {
      const result = yield* readConvexRuntimeQuery(
        runtimeUrl,
        query,
        args
      ).pipe(Effect.flip);

      expect(result).toEqual(
        new ConvexRuntimeQueryError({
          httpStatuses: [],
          networkCodes: [],
          query: queryName,
          reason: "query",
        })
      );
      expect(clientState.query).toHaveBeenCalledOnce();
      expect(fetch).toHaveBeenCalledOnce();
    });
  });

  it.effect("keeps client HTTP failures terminal", () => {
    queryThroughTerminalResponse(400, new Error("private client failure"));

    return Effect.gen(function* () {
      const result = yield* readConvexRuntimeQuery(
        runtimeUrl,
        query,
        args
      ).pipe(Effect.flip);

      expect(result).toEqual(
        new ConvexRuntimeQueryError({
          httpStatuses: [],
          networkCodes: [],
          query: queryName,
          reason: "query",
        })
      );
      expect(clientState.query).toHaveBeenCalledOnce();
      expect(fetch).toHaveBeenCalledOnce();
      expect(JSON.stringify(result)).not.toContain("private client failure");
    });
  });
});
