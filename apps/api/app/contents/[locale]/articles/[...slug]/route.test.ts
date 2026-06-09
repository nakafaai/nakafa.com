import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as route from "./route";

const runtimeMocks = vi.hoisted(() => ({
  getArticleApiContentPage: vi.fn(),
}));

vi.mock("@/lib/content/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content/runtime")>();

  return {
    ...actual,
    getArticleApiContentPage: runtimeMocks.getArticleApiContentPage,
  };
});

const articleRow = {
  description: "Political dynasty article.",
  locale: "en",
  route: "articles/politics/dynastic-politics-asian-values",
  slug: "dynastic-politics-asian-values",
  title: "Dynastic Politics",
};

describe("article content API route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the legacy array shape when pagination is not requested", async () => {
    runtimeMocks.getArticleApiContentPage.mockReturnValue(
      Effect.succeed({
        continueCursor: "",
        isDone: true,
        page: [articleRow],
      })
    );

    const response = await route.GET(
      new Request("http://localhost/contents/en/articles/politics"),
      {
        params: Promise.resolve({
          locale: "en",
          slug: ["politics"],
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([articleRow]);
    expect(runtimeMocks.getArticleApiContentPage).toHaveBeenCalledWith({
      cursor: null,
      limit: 100,
      locale: "en",
      prefix: "articles/politics",
    });
  });

  it("returns the pagination envelope when callers request pagination", async () => {
    const page = {
      continueCursor: "next-cursor",
      isDone: false,
      page: [articleRow],
    };

    runtimeMocks.getArticleApiContentPage.mockReturnValue(Effect.succeed(page));

    const response = await route.GET(
      new Request(
        "http://localhost/contents/en/articles/politics?cursor=page-1&limit=1"
      ),
      {
        params: Promise.resolve({
          locale: "en",
          slug: ["politics"],
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expect(runtimeMocks.getArticleApiContentPage).toHaveBeenCalledWith({
      cursor: "page-1",
      limit: 1,
      locale: "en",
      prefix: "articles/politics",
    });
  });
});
