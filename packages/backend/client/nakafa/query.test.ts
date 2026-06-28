import { fetchNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { api } from "@repo/backend/convex/_generated/api";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  fetchConvexRuntimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", () => ({
  fetchConvexRuntimeQuery: runtimeMocks.fetchConvexRuntimeQuery,
}));

describe("fetchNakafaRuntimeQuery", () => {
  beforeEach(() => {
    runtimeMocks.fetchConvexRuntimeQuery.mockReset();
  });

  it("returns generated query results from the shared Convex runtime client", async () => {
    const args: FunctionArgs<
      typeof api.contents.queries.runtime.getContentRoute
    > = {
      locale: "en",
      route: "articles/example",
    };
    runtimeMocks.fetchConvexRuntimeQuery.mockResolvedValueOnce(null);

    const result = await Effect.runPromise(
      fetchNakafaRuntimeQuery(
        "https://example.convex.cloud",
        "getContentRoute",
        api.contents.queries.runtime.getContentRoute,
        args
      )
    );

    expect(result).toBeNull();
    expect(runtimeMocks.fetchConvexRuntimeQuery).toHaveBeenCalledWith(
      "https://example.convex.cloud",
      api.contents.queries.runtime.getContentRoute,
      args
    );
  });

  it("maps runtime client failures into Nakafa read errors", async () => {
    const args: FunctionArgs<
      typeof api.contents.queries.runtime.getContentRoute
    > = {
      locale: "en",
      route: "articles/example",
    };
    runtimeMocks.fetchConvexRuntimeQuery.mockRejectedValueOnce(
      new Error("network down")
    );

    const result = await Effect.runPromise(
      Effect.either(
        fetchNakafaRuntimeQuery(
          "https://example.convex.cloud",
          "getContentRoute",
          api.contents.queries.runtime.getContentRoute,
          args
        )
      )
    );

    expect(result._tag).toBe("Left");

    if (result._tag === "Left") {
      expect(result.left).toBeInstanceOf(NakafaAgentDataReadError);
      expect(result.left.message).toContain("getContentRoute");
      expect(result.left.cause).toContain("network down");
    }
  });
});
