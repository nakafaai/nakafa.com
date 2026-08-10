import { ConvexRuntimeQueryError } from "@repo/backend/client/runtime";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getApiContentRouteByContentId,
  getArticleApiContentPage,
  getMaterialApiContentPage,
  listApiStaticParams,
  parseApiContentId,
  parseApiLocale,
  parseApiPageParams,
} from "@/lib/content/runtime";

const runtimeClientMocks = vi.hoisted(() => ({
  runtimeQuery: vi.fn(),
}));
const publishedMaterialMocks = vi.hoisted(() => ({
  readPublishedMaterialApiItem: vi.fn(),
  readPublishedMaterialGraphRoute: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", async (importOriginal) => ({
  ...(await importOriginal()),
  readConvexRuntimeQuery: (url: string, query: unknown, args: unknown) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: () => runtimeClientMocks.runtimeQuery(url, query, args),
    }),
}));
vi.mock("@/lib/content/material", () => publishedMaterialMocks);

describe("API content runtime", () => {
  afterEach(() => {
    runtimeClientMocks.runtimeQuery.mockReset();
    publishedMaterialMocks.readPublishedMaterialApiItem.mockReset();
    publishedMaterialMocks.readPublishedMaterialGraphRoute.mockReset();
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
    ).toEqual({
      cursor: "abc",
      limit: 5,
    });
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

  it("reads one page for each API runtime content query", async () => {
    const articlePage = { continueCursor: "", isDone: true, page: [] };
    const subjectPage = {
      activeReleaseId: null,
      continueCursor: "",
      isDone: true,
      page: [],
    };
    const routeRow = { content_id: "asset:en:article:politics:article:a" };

    runtimeClientMocks.runtimeQuery
      .mockResolvedValueOnce(articlePage)
      .mockResolvedValueOnce(subjectPage)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        activeReleaseId: null,
        managed: false,
        route: null,
        syncedAt: null,
      })
      .mockResolvedValueOnce(routeRow)
      .mockResolvedValueOnce(null);

    await expect(
      Effect.runPromise(
        getArticleApiContentPage({
          cursor: null,
          limit: 10,
          locale: "en",
          prefix: "articles/politics",
        })
      )
    ).resolves.toEqual(articlePage);
    expect(runtimeClientMocks.runtimeQuery).toHaveBeenCalledWith(
      "https://test.convex.cloud",
      expect.anything(),
      {
        cursor: null,
        limit: 10,
        locale: "en",
        prefix: "articles/politics",
      }
    );

    await expect(
      Effect.runPromise(
        getMaterialApiContentPage({
          cursor: "next",
          limit: 5,
          locale: "id",
          prefix: "curriculum/high-school/10/mathematics",
        })
      )
    ).resolves.toEqual({
      continueCursor: "",
      isDone: true,
      page: [],
    });
    expect(runtimeClientMocks.runtimeQuery).toHaveBeenCalledWith(
      "https://test.convex.cloud",
      expect.anything(),
      {
        cursor: "next",
        limit: 5,
        locale: "id",
        prefix: "curriculum/high-school/10/mathematics",
      }
    );

    await expect(
      Effect.runPromise(
        getApiContentRouteByContentId({
          contentId: "asset:en:article:politics:article:a",
        })
      )
    ).resolves.toEqual(routeRow);
    expect(runtimeClientMocks.runtimeQuery).toHaveBeenLastCalledWith(
      "https://test.convex.cloud",
      expect.anything(),
      {}
    );
  });

  it("rejects a source graph fallback after ownership changes", async () => {
    runtimeClientMocks.runtimeQuery
      .mockResolvedValueOnce({
        activeReleaseId: "release-before",
        managed: false,
        route: null,
        syncedAt: null,
      })
      .mockResolvedValueOnce({
        content_id: "asset:en:material:test:source",
      })
      .mockResolvedValueOnce({
        manifestHash: "manifest-after",
        releaseId: "release-after",
        sequence: 2,
      });

    await expect(
      Effect.runPromise(
        getApiContentRouteByContentId({
          contentId: "asset:en:material:test:source",
        })
      )
    ).rejects.toThrow("Content ownership changed during the public API read.");
  });

  it("reconciles source and signed material page entries", async () => {
    const sourceItem = { slug: "material/lesson/test/source" };
    const publishedItem = { slug: "material/lesson/test/published" };
    runtimeClientMocks.runtimeQuery.mockResolvedValueOnce({
      activeReleaseId: "release-test",
      continueCursor: "",
      isDone: true,
      page: [
        { item: sourceItem, kind: "source" },
        {
          kind: "published",
          locale: "en",
          publicPath: "subjects/test/published",
        },
      ],
    });
    runtimeClientMocks.runtimeQuery.mockResolvedValueOnce({
      releaseId: "release-test",
    });
    publishedMaterialMocks.readPublishedMaterialApiItem.mockReturnValue(
      Effect.succeed(publishedItem)
    );

    await expect(
      Effect.runPromise(
        getMaterialApiContentPage({
          cursor: null,
          limit: 10,
          locale: "en",
          prefix: "material/lesson/test",
        })
      )
    ).resolves.toEqual({
      continueCursor: "",
      isDone: true,
      page: [sourceItem, publishedItem],
    });
    expect(
      publishedMaterialMocks.readPublishedMaterialApiItem
    ).toHaveBeenCalledWith({
      activeReleaseId: "release-test",
      locale: "en",
      publicPath: "subjects/test/published",
    });
  });

  it("rejects a source material page after ownership changes", async () => {
    runtimeClientMocks.runtimeQuery
      .mockResolvedValueOnce({
        activeReleaseId: "release-before",
        continueCursor: "",
        isDone: true,
        page: [
          { item: { slug: "material/lesson/test/source" }, kind: "source" },
        ],
      })
      .mockResolvedValueOnce({ releaseId: "release-after" });

    await expect(
      Effect.runPromise(
        getMaterialApiContentPage({
          cursor: null,
          limit: 10,
          locale: "en",
          prefix: "material/lesson/test",
        })
      )
    ).rejects.toThrow("Content ownership changed during the public API read.");
  });

  it("rejects incomplete or failed signed material page reads", async () => {
    runtimeClientMocks.runtimeQuery
      .mockResolvedValueOnce({
        activeReleaseId: null,
        continueCursor: "",
        isDone: true,
        page: [
          {
            kind: "published",
            locale: "en",
            publicPath: "subjects/test/missing-release",
          },
        ],
      })
      .mockResolvedValueOnce({
        activeReleaseId: "release-test",
        continueCursor: "",
        isDone: true,
        page: [
          {
            kind: "published",
            locale: "en",
            publicPath: "subjects/test/failure",
          },
        ],
      });

    await expect(
      Effect.runPromise(
        getMaterialApiContentPage({
          cursor: null,
          limit: 10,
          locale: "en",
          prefix: "material/lesson/test",
        })
      )
    ).rejects.toThrow("Published material API entry has no active release.");

    publishedMaterialMocks.readPublishedMaterialApiItem.mockReturnValue(
      Effect.fail(new Error("signature mismatch"))
    );
    await expect(
      Effect.runPromise(
        getMaterialApiContentPage({
          cursor: null,
          limit: 10,
          locale: "en",
          prefix: "material/lesson/test",
        })
      )
    ).rejects.toThrow(
      "Unable to read signed material content for the public API."
    );
  });

  it("resolves exact graph routes and preserves managed tombstones", async () => {
    const exactRoute = {
      content_id: "asset:en:material:test:exact",
      route: "subjects/test/exact",
    };
    runtimeClientMocks.runtimeQuery
      .mockResolvedValueOnce({
        activeReleaseId: "release-test",
        managed: true,
        route: { locale: "en", publicPath: "subjects/test/exact" },
        syncedAt: 42,
      })
      .mockResolvedValueOnce({
        activeReleaseId: "release-test",
        managed: true,
        route: null,
        syncedAt: 42,
      });
    publishedMaterialMocks.readPublishedMaterialGraphRoute.mockReturnValue(
      Effect.succeed(exactRoute)
    );

    await expect(
      Effect.runPromise(
        getApiContentRouteByContentId({
          contentId: "asset:en:material:test:exact",
        })
      )
    ).resolves.toBe(exactRoute);
    expect(
      publishedMaterialMocks.readPublishedMaterialGraphRoute
    ).toHaveBeenCalledWith({
      activeReleaseId: "release-test",
      locale: "en",
      publicPath: "subjects/test/exact",
      syncedAt: 42,
    });
    await expect(
      Effect.runPromise(
        getApiContentRouteByContentId({
          contentId: "asset:en:material:test:deleted",
        })
      )
    ).resolves.toBeNull();
    expect(runtimeClientMocks.runtimeQuery).toHaveBeenCalledTimes(2);
  });

  it("rejects incomplete or failed exact graph reads", async () => {
    runtimeClientMocks.runtimeQuery
      .mockResolvedValueOnce({
        activeReleaseId: null,
        managed: true,
        route: { locale: "en", publicPath: "subjects/test/exact" },
        syncedAt: 42,
      })
      .mockResolvedValueOnce({
        activeReleaseId: "release-test",
        managed: true,
        route: { locale: "en", publicPath: "subjects/test/exact" },
        syncedAt: null,
      })
      .mockResolvedValueOnce({
        activeReleaseId: "release-test",
        managed: true,
        route: { locale: "en", publicPath: "subjects/test/exact" },
        syncedAt: 42,
      });

    for (const contentId of [
      "asset:en:material:test:missing-release",
      "asset:en:material:test:missing-time",
    ]) {
      await expect(
        Effect.runPromise(getApiContentRouteByContentId({ contentId }))
      ).rejects.toThrow("Published material graph route is incomplete.");
    }

    publishedMaterialMocks.readPublishedMaterialGraphRoute.mockReturnValue(
      Effect.fail(new Error("signature mismatch"))
    );
    await expect(
      Effect.runPromise(
        getApiContentRouteByContentId({
          contentId: "asset:en:material:test:failure",
        })
      )
    ).rejects.toThrow(
      "Unable to read signed material content for the public API."
    );
  });

  it("wraps runtime query failures with content runtime context", async () => {
    runtimeClientMocks.runtimeQuery.mockRejectedValueOnce(
      new ConvexRuntimeQueryError({
        networkCodes: [],
        query: "contents/queries/runtime:listArticleApiContentPage",
        reason: "transport",
      })
    );

    const effect = getArticleApiContentPage({
      cursor: null,
      limit: 10,
      locale: "en",
      prefix: "articles/politics",
    });

    await expect(Effect.runPromise(effect)).rejects.toThrow(
      "Unable to read API content runtime query: contents/queries/runtime:listArticleApiContentPage."
    );
  });

  it("maps route catalog rows into API static params", async () => {
    runtimeClientMocks.runtimeQuery
      .mockResolvedValueOnce({
        continueCursor: "",
        isDone: true,
        page: [
          {
            route: "articles/politics/dynastic-politics-asian-values",
          },
        ],
      })
      .mockResolvedValueOnce({
        continueCursor: "",
        isDone: true,
        page: [
          {
            route: "articles/politics/political-accountability",
          },
        ],
      });

    await expect(
      listApiStaticParams({
        prefix: "articles/",
        section: "articles",
      })
    ).resolves.toEqual([
      {
        locale: "en",
        slug: ["politics", "dynastic-politics-asian-values"],
      },
      {
        locale: "id",
        slug: ["politics", "political-accountability"],
      },
    ]);
    expect(runtimeClientMocks.runtimeQuery).toHaveBeenCalledTimes(2);
    expect(runtimeClientMocks.runtimeQuery).toHaveBeenCalledWith(
      "https://test.convex.cloud",
      expect.anything(),
      {
        cursor: null,
        limit: 100,
        locale: "en",
        prefix: "articles/",
        section: "articles",
      }
    );
    expect(runtimeClientMocks.runtimeQuery).toHaveBeenCalledWith(
      "https://test.convex.cloud",
      expect.anything(),
      {
        cursor: null,
        limit: 100,
        locale: "id",
        prefix: "articles/",
        section: "articles",
      }
    );
  });
});
