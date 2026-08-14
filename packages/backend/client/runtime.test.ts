// @vitest-environment node

import {
  ConvexRuntimeQueryError,
  readConvexRuntimeQuery,
} from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { Duration, Effect, Fiber, TestClock, TestContext } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

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

const runWithTestClock = <Value, Error>(program: Effect.Effect<Value, Error>) =>
  Effect.runPromise(program.pipe(Effect.provide(TestContext.TestContext)));

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
function createFetchFailure(code?: string) {
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
  it("retries Effect callers through the typed network channel", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(createFetchFailure("ECONNRESET"))
      .mockRejectedValueOnce(createFetchFailure("UND_ERR_SOCKET"))
      .mockResolvedValueOnce(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    queryThroughFetch(42);
    const program = Effect.gen(function* () {
      const fiber = yield* Effect.fork(
        readConvexRuntimeQuery(runtimeUrl, query, args)
      );
      yield* TestClock.adjust(Duration.millis(1500));

      return yield* Fiber.join(fiber);
    });

    await expect(runWithTestClock(program)).resolves.toBe(42);
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

  it("does not retry Convex function failures", async () => {
    clientState.query.mockRejectedValueOnce(new ConvexError("public failure"));

    await expect(
      Effect.runPromise(
        readConvexRuntimeQuery(runtimeUrl, query, args).pipe(Effect.flip)
      )
    ).resolves.toEqual(
      new ConvexRuntimeQueryError({
        networkCodes: [],
        query: queryName,
        reason: "query",
      })
    );
    expect(clientState.query).toHaveBeenCalledOnce();
  });

  it("preserves sanitized codes after retry exhaustion", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(createFetchFailure("EPIPE"));
    vi.stubGlobal("fetch", fetchMock);
    queryThroughFetch();
    const program = Effect.gen(function* () {
      const fiber = yield* Effect.fork(
        readConvexRuntimeQuery(runtimeUrl, query, args).pipe(Effect.flip)
      );
      yield* TestClock.adjust(Duration.millis(1500));

      return yield* Fiber.join(fiber);
    });
    const result = runWithTestClock(program);

    await expect(result).resolves.toEqual(
      new ConvexRuntimeQueryError({
        networkCodes: ["EPIPE"],
        query: queryName,
        reason: "transport",
      })
    );
    expect(clientState.query).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(await result)).not.toContain(
      "private network detail"
    );
  });

  it("does not retry unclassified or timeout fetch failures", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(createFetchFailure("UND_ERR_CONNECT_TIMEOUT"));
    vi.stubGlobal("fetch", fetchMock);
    queryThroughFetch();

    await expect(
      Effect.runPromise(
        readConvexRuntimeQuery(runtimeUrl, query, args).pipe(Effect.flip)
      )
    ).resolves.toEqual(
      new ConvexRuntimeQueryError({
        networkCodes: [],
        query: queryName,
        reason: "transport",
      })
    );
    expect(clientState.query).toHaveBeenCalledOnce();
  });

  it("sanitizes non-Convex query failures", async () => {
    clientState.query.mockRejectedValueOnce(new Error("private client detail"));

    const result = Effect.runPromise(
      readConvexRuntimeQuery(runtimeUrl, query, args).pipe(Effect.flip)
    );

    await expect(result).resolves.toEqual(
      new ConvexRuntimeQueryError({
        networkCodes: [],
        query: queryName,
        reason: "query",
      })
    );
    expect(JSON.stringify(await result)).not.toContain("private client detail");
  });

  it("converts synchronous client construction failures to typed errors", async () => {
    clientState.constructorFailure.error = new Error(
      "private constructor detail"
    );

    await expect(
      Effect.runPromise(
        readConvexRuntimeQuery(runtimeUrl, query, args).pipe(Effect.flip)
      )
    ).resolves.toEqual(
      new ConvexRuntimeQueryError({
        networkCodes: [],
        query: queryName,
        reason: "client",
      })
    );
    expect(clientState.query).not.toHaveBeenCalled();
  });
});
