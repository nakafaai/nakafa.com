import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const runtimeMocks = vi.hoisted(() => ({
  getApiContentReferenceByContentId: vi.fn(),
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
    getApiContentReferenceByContentId:
      runtimeMocks.getApiContentReferenceByContentId,
  };
});

const articleRef = readNakafaContentRefFixture(
  "en",
  "articles/politics/example",
  "articles"
);

describe("content reference API route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns one current signed reference", async () => {
    runtimeMocks.getApiContentReferenceByContentId.mockReturnValue(
      Effect.succeed(articleRef)
    );

    const response = await GET(
      new Request(
        `http://localhost/contents/reference/${articleRef.content_id}`
      ),
      { params: Promise.resolve({ contentId: articleRef.content_id }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(articleRef);
    expect(runtimeMocks.getApiContentReferenceByContentId).toHaveBeenCalledWith(
      { contentId: articleRef.content_id }
    );
  });

  it("rejects route-shaped content IDs before reading Convex", async () => {
    const response = await GET(
      new Request("http://localhost/contents/reference/en/articles/example"),
      { params: Promise.resolve({ contentId: "en/articles/example" }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid graph content ID.",
    });
    expect(
      runtimeMocks.getApiContentReferenceByContentId
    ).not.toHaveBeenCalled();
  });

  it("returns not found when no signed family owns the graph ID", async () => {
    runtimeMocks.getApiContentReferenceByContentId.mockReturnValue(
      Effect.succeed(null)
    );

    const response = await GET(
      new Request(
        `http://localhost/contents/reference/${articleRef.content_id}`
      ),
      { params: Promise.resolve({ contentId: articleRef.content_id }) }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Content reference not found.",
    });
  });

  it("logs Convex read failures and returns an API error", async () => {
    const readError = new Error("Convex unavailable");
    runtimeMocks.getApiContentReferenceByContentId.mockReturnValue(
      Effect.fail(readError)
    );

    const response = await GET(
      new Request(
        `http://localhost/contents/reference/${articleRef.content_id}`
      ),
      { params: Promise.resolve({ contentId: articleRef.content_id }) }
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to resolve graph content ID.",
    });
    expect(loggingMocks.logError).toHaveBeenCalledWith(readError, {
      service: "api-content-reference",
      contentId: articleRef.content_id,
      message: "Failed to resolve graph content ID.",
    });
  });
});
