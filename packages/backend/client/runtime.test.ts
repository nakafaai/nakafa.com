import { fetchConvexRuntimeQuery } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const clientState = vi.hoisted(() => {
  const instances: Array<{
    options: {
      fetch?: typeof fetch;
      logger?: boolean;
    };
    url: string;
  }> = [];
  const query = vi.fn();

  return {
    instances,
    query,
  };
});

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = clientState.query;

    /** Records official Convex client construction for runtime query tests. */
    constructor(
      url: string,
      options: {
        fetch?: typeof fetch;
        logger?: boolean;
      }
    ) {
      clientState.instances.push({ options, url });
    }
  },
}));

describe("fetchConvexRuntimeQuery", () => {
  afterEach(() => {
    clientState.instances.length = 0;
    clientState.query.mockReset();
    vi.unstubAllGlobals();
  });

  it("uses the official Convex client with no-store fetch settings", async () => {
    const args: FunctionArgs<
      typeof api.contents.queries.runtime.getContentRoute
    > = {
      locale: "en",
      route: "articles/example",
    };
    clientState.query.mockResolvedValueOnce(null);

    const result = await fetchConvexRuntimeQuery(
      "https://example.convex.cloud",
      api.contents.queries.runtime.getContentRoute,
      args
    );

    expect(result).toBeNull();
    expect(clientState.instances[0]?.url).toBe("https://example.convex.cloud");
    expect(clientState.instances[0]?.options.logger).toBe(false);
    expect(clientState.query).toHaveBeenCalledWith(
      api.contents.queries.runtime.getContentRoute,
      args
    );

    /** Captures fetch calls made through the shared no-store fetch hook. */
    const fetchMock = vi.fn(() => Promise.resolve(new Response("ok")));
    vi.stubGlobal("fetch", fetchMock);
    const fetchHook = clientState.instances[0]?.options.fetch;

    if (!fetchHook) {
      throw new Error("Expected Convex runtime fetch hook.");
    }

    await fetchHook("https://convex.test", {
      cache: "force-cache",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://convex.test", {
      cache: "no-store",
    });
  });
});
