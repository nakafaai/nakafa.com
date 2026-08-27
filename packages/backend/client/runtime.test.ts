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

const clientState = vi.hoisted(() => {
  const constructorFailure: { error: Error | undefined } = {
    error: undefined,
  };
  const instances: Array<{
    options: {
      fetch?: typeof fetch;
      logger?: boolean;
    };
    url: string;
  }> = [];
  const query = vi.fn();

  return { constructorFailure, instances, query };
});

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    private readonly fetchHook: typeof fetch | undefined;

    /** Records official Convex client construction for runtime query tests. */
    constructor(
      url: string,
      options: {
        fetch?: typeof fetch;
        logger?: boolean;
      }
    ) {
      if (clientState.constructorFailure.error) {
        throw clientState.constructorFailure.error;
      }
      this.fetchHook = options.fetch;
      clientState.instances.push({ options, url });
    }

    /** Delegates query behavior to the test-owned client seam. */
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

/** Makes the mocked official client execute its configured fetch hook. */
function queryThroughFetch(result: unknown = null) {
  clientState.query.mockImplementation(
    async (fetchHook: typeof fetch | undefined) => {
      if (!fetchHook) {
        return Promise.reject(new Error("Expected Convex runtime fetch hook."));
      }

      await fetchHook("https://runtime.example/api/query", {
        cache: "force-cache",
      });
      return result;
    }
  );
}

/** Creates the nested rejection shape produced by Node fetch. */
function createNetworkFailure(code?: string) {
  const cause = code
    ? Object.assign(new Error("private network detail"), { code })
    : new Error("private network detail");
  return new TypeError("fetch failed", { cause });
}

afterEach(() => {
  clientState.constructorFailure.error = undefined;
  clientState.instances.length = 0;
  clientState.query.mockReset();
  vi.unstubAllGlobals();
});

describe("Convex runtime query", () => {
  it.effect("retries Effect callers through the typed network channel", () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(createNetworkFailure("ECONNRESET"))
      .mockRejectedValueOnce(createNetworkFailure("UND_ERR_SOCKET"))
      .mockResolvedValueOnce(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    queryThroughFetch(42);
    return Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        readConvexRuntimeQuery(runtimeUrl, query, args)
      );
      yield* TestClock.adjust(Duration.millis(1500));
      const result = yield* Fiber.join(fiber);

      expect(result).toBe(42);
      expect(clientState.query).toHaveBeenCalledTimes(3);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock).toHaveBeenLastCalledWith(
        "https://runtime.example/api/query",
        {
          cache: "no-store",
        }
      );
      expect(clientState.instances).toEqual([
        {
          options: {
            fetch: expect.any(Function),
            logger: false,
          },
          url: runtimeUrl,
        },
      ]);
    });
  });

  it.effect("retries allowlisted response-stream network failures", () => {
    clientState.query
      .mockRejectedValueOnce(createNetworkFailure("UND_ERR_SOCKET"))
      .mockResolvedValueOnce(42);

    return Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        readConvexRuntimeQuery(runtimeUrl, query, args)
      );
      yield* TestClock.adjust(Duration.millis(500));

      expect(yield* Fiber.join(fiber)).toBe(42);
      expect(clientState.query).toHaveBeenCalledTimes(2);
    });
  });

  it.effect("does not retry Convex function failures", () =>
    Effect.gen(function* () {
      clientState.query.mockRejectedValueOnce(
        new ConvexError("public failure")
      );

      expect(
        yield* readConvexRuntimeQuery(runtimeUrl, query, args).pipe(Effect.flip)
      ).toEqual(
        new ConvexRuntimeQueryError({
          networkCodes: [],
          query: queryName,
          reason: "query",
        })
      );
      expect(clientState.query).toHaveBeenCalledOnce();
    })
  );

  it.effect("preserves sanitized codes after retry exhaustion", () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(createNetworkFailure("EPIPE"));
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
          networkCodes: ["EPIPE"],
          query: queryName,
          reason: "transport",
        })
      );
      expect(clientState.query).toHaveBeenCalledTimes(3);
      expect(JSON.stringify(result)).not.toContain("private network detail");
    });
  });

  it.effect("does not retry unclassified or timeout fetch failures", () =>
    Effect.gen(function* () {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockRejectedValue(createNetworkFailure("UND_ERR_CONNECT_TIMEOUT"));
      vi.stubGlobal("fetch", fetchMock);
      queryThroughFetch();

      expect(
        yield* readConvexRuntimeQuery(runtimeUrl, query, args).pipe(Effect.flip)
      ).toEqual(
        new ConvexRuntimeQueryError({
          networkCodes: [],
          query: queryName,
          reason: "transport",
        })
      );
      expect(clientState.query).toHaveBeenCalledOnce();
    })
  );

  it.effect("sanitizes non-Convex query failures", () =>
    Effect.gen(function* () {
      clientState.query.mockRejectedValueOnce(
        new Error("private client detail")
      );

      const result = yield* readConvexRuntimeQuery(
        runtimeUrl,
        query,
        args
      ).pipe(Effect.flip);

      expect(result).toEqual(
        new ConvexRuntimeQueryError({
          networkCodes: [],
          query: queryName,
          reason: "query",
        })
      );
      expect(JSON.stringify(result)).not.toContain("private client detail");
    })
  );

  it.effect(
    "converts synchronous client construction failures to typed errors",
    () =>
      Effect.gen(function* () {
        clientState.constructorFailure.error = new Error(
          "private constructor detail"
        );

        expect(
          yield* readConvexRuntimeQuery(runtimeUrl, query, args).pipe(
            Effect.flip
          )
        ).toEqual(
          new ConvexRuntimeQueryError({
            networkCodes: [],
            query: queryName,
            reason: "client",
          })
        );
        expect(clientState.query).not.toHaveBeenCalled();
      })
  );
});
