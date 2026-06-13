import { buildNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const runtimeMocks = vi.hoisted(() => ({
  getApiContentRouteByContentId: vi.fn(),
}));
const loggingMocks = vi.hoisted(() => ({
  logError: vi.fn(),
}));

vi.mock("@repo/utilities/logging/effect", async () => {
  const { Effect } = await import("effect");

  return {
    logError: (...args: unknown[]) => {
      loggingMocks.logError(...args);
      return Effect.void;
    },
  };
});

vi.mock("@/lib/content/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content/runtime")>();

  return {
    ...actual,
    getApiContentRouteByContentId: runtimeMocks.getApiContentRouteByContentId,
  };
});

const articleRef = buildNakafaContentRef(
  "en",
  "articles/politics/example",
  "articles"
);
const routeRow = {
  ...articleRef,
  authors: [{ name: "Nakafa" }],
  contentHash: "hash",
  kind: "article",
  markdown: true,
  syncedAt: 1,
  title: "Example Article",
};

describe("content graph API route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a route projection for a graph content ID", async () => {
    runtimeMocks.getApiContentRouteByContentId.mockReturnValue(
      Effect.succeed(routeRow)
    );

    const response = await GET(
      new Request(`http://localhost/contents/graph/${articleRef.content_id}`),
      {
        params: Promise.resolve({
          contentId: articleRef.content_id,
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(routeRow);
    expect(runtimeMocks.getApiContentRouteByContentId).toHaveBeenCalledWith({
      contentId: articleRef.content_id,
    });
  });

  it("rejects route-shaped content IDs before reading Convex", async () => {
    const response = await GET(
      new Request("http://localhost/contents/graph/en/articles/example"),
      {
        params: Promise.resolve({
          contentId: "en/articles/example",
        }),
      }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid graph content ID.",
    });
    expect(runtimeMocks.getApiContentRouteByContentId).not.toHaveBeenCalled();
  });

  it("returns not found when the graph ID has no route projection", async () => {
    runtimeMocks.getApiContentRouteByContentId.mockReturnValue(
      Effect.succeed(null)
    );

    const response = await GET(
      new Request(`http://localhost/contents/graph/${articleRef.content_id}`),
      {
        params: Promise.resolve({
          contentId: articleRef.content_id,
        }),
      }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Content route not found.",
    });
  });

  it("logs Convex read failures and returns an API error", async () => {
    const readError = new Error("Convex unavailable");
    runtimeMocks.getApiContentRouteByContentId.mockReturnValue(
      Effect.fail(readError)
    );

    const response = await GET(
      new Request(`http://localhost/contents/graph/${articleRef.content_id}`),
      {
        params: Promise.resolve({
          contentId: articleRef.content_id,
        }),
      }
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to resolve graph content ID.",
    });
    expect(loggingMocks.logError).toHaveBeenCalledWith(readError, {
      service: "api-content-graph",
      contentId: articleRef.content_id,
      message: "Failed to resolve graph content ID.",
    });
  });
});
