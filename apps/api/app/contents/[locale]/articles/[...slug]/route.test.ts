import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as route from "./route";

const runtimeMocks = vi.hoisted(() => ({
  getArticleApiContentPage: vi.fn(),
  listApiStaticParams: vi.fn(),
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
    getArticleApiContentPage: runtimeMocks.getArticleApiContentPage,
    listApiStaticParams: runtimeMocks.listApiStaticParams,
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

  it("generates static params from the Convex route catalog", async () => {
    const params = [{ locale: "en", slug: ["politics"] }];
    runtimeMocks.listApiStaticParams.mockResolvedValue(params);

    await expect(route.generateStaticParams()).resolves.toEqual(params);
    expect(runtimeMocks.listApiStaticParams).toHaveBeenCalledWith({
      prefix: "articles/",
      section: "articles",
    });
  });

  it("returns the pagination envelope for default article requests", async () => {
    const page = {
      continueCursor: "",
      isDone: true,
      page: [articleRow],
    };

    runtimeMocks.getArticleApiContentPage.mockReturnValue(Effect.succeed(page));

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
    expect(await response.json()).toEqual(page);
    expect(runtimeMocks.getArticleApiContentPage).toHaveBeenCalledWith({
      cursor: null,
      limit: 100,
      locale: "en",
      prefix: "articles/politics",
    });
  });

  it("returns the pagination envelope for explicit article pagination", async () => {
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

  it("rejects invalid locales before reading Convex", async () => {
    const response = await route.GET(
      new Request("http://localhost/contents/fr/articles/politics"),
      {
        params: Promise.resolve({
          locale: "fr",
          slug: ["politics"],
        }),
      }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid locale. Supported locales: en, id.",
    });
    expect(runtimeMocks.getArticleApiContentPage).not.toHaveBeenCalled();
  });

  it("rejects invalid pagination before reading Convex", async () => {
    const response = await route.GET(
      new Request("http://localhost/contents/en/articles/politics?limit=101"),
      {
        params: Promise.resolve({
          locale: "en",
          slug: ["politics"],
        }),
      }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid pagination. Limit must be between 1 and 100.",
    });
    expect(runtimeMocks.getArticleApiContentPage).not.toHaveBeenCalled();
  });

  it("logs Convex read failures and returns an API error", async () => {
    const readError = new Error("Convex unavailable");
    runtimeMocks.getArticleApiContentPage.mockReturnValue(
      Effect.fail(readError)
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

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to fetch contents.",
    });
    expect(loggingMocks.logError).toHaveBeenCalledWith(readError, {
      service: "api-contents",
      locale: "en",
      basePath: "politics",
      slugLength: 1,
      message: "Failed to fetch contents.",
    });
  });

  it("logs root article prefix failures with a readable base path", async () => {
    const readError = new Error("Convex unavailable");
    runtimeMocks.getArticleApiContentPage.mockReturnValue(
      Effect.fail(readError)
    );

    const response = await route.GET(
      new Request("http://localhost/contents/en/articles"),
      {
        params: Promise.resolve({
          locale: "en",
          slug: [],
        }),
      }
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to fetch contents.",
    });
    expect(loggingMocks.logError).toHaveBeenCalledWith(readError, {
      service: "api-contents",
      locale: "en",
      basePath: "/",
      slugLength: 0,
      message: "Failed to fetch contents.",
    });
  });
});
