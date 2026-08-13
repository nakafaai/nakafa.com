import { ConvexRuntimeQueryError } from "@repo/backend/client/runtime";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getApiContentRouteByContentId,
  getArticleApiContentPage,
  getMaterialApiContentPage,
  parseApiContentId,
  parseApiLocale,
  parseApiPageParams,
} from "@/lib/content/runtime";

const runtimeClientMocks = vi.hoisted(() => ({
  runtimeQuery: vi.fn(),
}));
const publishedContentMocks = vi.hoisted(() => ({
  readPublishedApiItem: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", async (importOriginal) => ({
  ...(await importOriginal()),
  readConvexRuntimeQuery: (url: string, query: unknown, args: unknown) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: () => runtimeClientMocks.runtimeQuery(url, query, args),
    }),
}));
vi.mock("@/lib/content/published", () => publishedContentMocks);

describe("API content runtime", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("narrows supported route locales", () => {
    for (const locale of locales) {
      expect(parseApiLocale(locale)).toBe(locale);
    }

    expect(parseApiLocale("fr")).toBeNull();
  });

  it("parses bounded page params", () => {
    expect(parseApiPageParams(new URLSearchParams())).toEqual({
      cursor: null,
      limit: 100,
    });
    expect(
      parseApiPageParams(new URLSearchParams("cursor=abc&limit=5"))
    ).toEqual({ cursor: "abc", limit: 5 });
    expect(parseApiPageParams(new URLSearchParams("limit=0"))).toBeNull();
    expect(parseApiPageParams(new URLSearchParams("limit=101"))).toBeNull();
    expect(parseApiPageParams(new URLSearchParams("limit=abc"))).toBeNull();
  });

  it("narrows graph-backed content IDs", () => {
    expect(parseApiContentId("asset:en:article:politics:article:a")).toBe(
      "asset:en:article:politics:article:a"
    );
    expect(parseApiContentId("en/articles/a")).toBeNull();
  });

  it.each([
    {
      args: {
        cursor: null,
        limit: 10,
        locale: "en" as const,
        prefix: "articles/politics",
      },
      family: "article" as const,
      read: getArticleApiContentPage,
    },
    {
      args: {
        cursor: "next",
        limit: 5,
        locale: "id" as const,
        prefix: "material/lesson/mathematics",
      },
      family: "material" as const,
      read: getMaterialApiContentPage,
    },
  ])(
    "hydrates one current signed $family page",
    async ({ args, family, read }) => {
      const publishedItem = { slug: `${family}/published` };
      runtimeClientMocks.runtimeQuery
        .mockResolvedValueOnce({
          activeReleaseId: "release-test",
          continueCursor: "",
          isDone: true,
          page: [{ locale: args.locale, publicPath: `${family}/published` }],
        })
        .mockResolvedValueOnce({ releaseId: "release-test" });
      publishedContentMocks.readPublishedApiItem.mockReturnValue(
        Effect.succeed(publishedItem)
      );

      await expect(Effect.runPromise(read(args))).resolves.toEqual({
        continueCursor: "",
        isDone: true,
        page: [publishedItem],
      });
      expect(publishedContentMocks.readPublishedApiItem).toHaveBeenCalledWith({
        activeReleaseId: "release-test",
        family,
        locale: args.locale,
        publicPath: `${family}/published`,
      });
      expect(runtimeClientMocks.runtimeQuery).toHaveBeenNthCalledWith(
        1,
        "https://test.convex.cloud",
        expect.anything(),
        args
      );
    }
  );

  it.each([{ releaseId: "release-after" }, null])(
    "rejects a page when its signed release changes or disappears",
    async (active) => {
      runtimeClientMocks.runtimeQuery
        .mockResolvedValueOnce({
          activeReleaseId: "release-before",
          continueCursor: "",
          isDone: true,
          page: [],
        })
        .mockResolvedValueOnce(active);

      await expect(
        Effect.runPromise(
          getArticleApiContentPage({
            cursor: null,
            limit: 10,
            locale: "en",
            prefix: "articles/politics",
          })
        )
      ).rejects.toThrow(
        "Content ownership changed during the public API read."
      );
    }
  );

  it("maps signed hydration failures into the API runtime error", async () => {
    runtimeClientMocks.runtimeQuery.mockResolvedValueOnce({
      activeReleaseId: "release-test",
      continueCursor: "",
      isDone: true,
      page: [{ locale: "en", publicPath: "articles/politics/test" }],
    });
    publishedContentMocks.readPublishedApiItem.mockReturnValue(
      Effect.fail(new Error("signature mismatch"))
    );

    await expect(
      Effect.runPromise(
        getArticleApiContentPage({
          cursor: null,
          limit: 10,
          locale: "en",
          prefix: "articles/politics",
        })
      )
    ).rejects.toThrow("Unable to read signed content for the public API.");
  });

  it("reads one current reference by stable graph content ID", async () => {
    const row = { contentId: "asset:en:article:politics:article:a" };
    runtimeClientMocks.runtimeQuery.mockResolvedValueOnce(row);

    await expect(
      Effect.runPromise(
        getApiContentRouteByContentId({ contentId: row.contentId })
      )
    ).resolves.toEqual(row);
    expect(runtimeClientMocks.runtimeQuery).toHaveBeenCalledWith(
      "https://test.convex.cloud",
      expect.anything(),
      { input: { contentId: row.contentId, kind: "content" } }
    );
  });

  it("wraps runtime query failures with query context", async () => {
    runtimeClientMocks.runtimeQuery.mockRejectedValueOnce(
      new ConvexRuntimeQueryError({
        networkCodes: [],
        query: "contentRelease/article:apiPage",
        reason: "transport",
      })
    );

    await expect(
      Effect.runPromise(
        getArticleApiContentPage({
          cursor: null,
          limit: 10,
          locale: "en",
          prefix: "articles/politics",
        })
      )
    ).rejects.toThrow(
      "Unable to read API content runtime query: contentRelease/article:apiPage."
    );
  });
});
