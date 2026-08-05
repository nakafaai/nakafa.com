// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/rss.xml/route";

const mockFetchRuntimeQuranSurahs = vi.hoisted(() => vi.fn());
const mockGetRuntimeLatestContentRoutePage = vi.hoisted(() => vi.fn());
const mockReadActiveContentIdentity = vi.hoisted(() => vi.fn());
const mockReadPublishedLatestArticles = vi.hoisted(() => vi.fn());
const mockReadPublishedLatestMaterials = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/article/discovery", () => ({
  readPublishedLatestArticles: mockReadPublishedLatestArticles,
}));
vi.mock("@/lib/content/material/discovery", () => ({
  readPublishedLatestMaterials: mockReadPublishedLatestMaterials,
}));
vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: mockReadActiveContentIdentity,
}));
vi.mock("@/lib/content/runtime/pages", () => ({
  fetchRuntimeQuranSurahs: mockFetchRuntimeQuranSurahs,
}));
vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeLatestContentRoutePage: mockGetRuntimeLatestContentRoutePage,
}));
vi.mock("@/lib/utils/pages/quran", () => ({
  getQuranSurahName: () => "Al-Fatihah",
}));
vi.mock("next-intl/server", () => ({
  getTranslations: ({ namespace }: { namespace: string }) =>
    Promise.resolve((key: string) => `${namespace}.${key}`),
}));

const activeReleaseId = "release-material";

beforeEach(() => {
  mockFetchRuntimeQuranSurahs.mockReset().mockResolvedValue([
    {
      name: {
        translation: { en: "The Opening", id: "Pembukaan" },
      },
      number: 1,
    },
  ]);
  mockReadActiveContentIdentity
    .mockReset()
    .mockReturnValue(Effect.succeed({ releaseId: activeReleaseId }));
  mockReadPublishedLatestArticles
    .mockReset()
    .mockReturnValue(Effect.succeed({ articles: [], managed: false }));
  mockReadPublishedLatestMaterials.mockReset().mockReturnValue(
    Effect.succeed({
      activeReleaseId,
      materials: [],
    })
  );
  mockGetRuntimeLatestContentRoutePage
    .mockReset()
    .mockImplementation(({ section }) => {
      if (section !== "articles") {
        return Effect.succeed({ continueCursor: "", isDone: true, page: [] });
      }
      return Effect.succeed({
        continueCursor: "",
        isDone: true,
        page: [
          {
            authors: [{ name: "Nakafa" }],
            date: Date.parse("2026-01-01T00:00:00.000Z"),
            locale: "id",
            route: "articles/politics/example",
            sourcePath: "articles/politics/example",
            title: "Article title",
          },
          {
            authors: [{ name: "Nakafa" }],
            description: "Undated article description",
            locale: "id",
            route: "articles/politics/undated",
            sourcePath: "articles/politics/undated",
            title: "Undated article",
          },
        ],
      });
    });
});

describe("rss route", () => {
  it("serves source articles, signed materials, and Quran as RSS XML", async () => {
    mockReadPublishedLatestMaterials.mockReturnValue(
      Effect.succeed({
        activeReleaseId,
        materials: [
          {
            authors: [{ name: "Nabil Akbarazzima Fatih" }],
            date: "2025-04-27",
            description: "Understand functions as input-output relationships.",
            publicPath:
              "subjects/mathematics/function-composition-inverse-function/function-concept",
            sourcePath:
              "packages/corpus/material/lesson/mathematics/function-composition-inverse-function/function-concept/en.mdx",
            title: "Function Concept",
          },
        ],
      })
    );

    const response = await GET();
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain(
      "application/rss+xml"
    );
    expect(text).toContain("<rss");
    expect(text).toContain("<![CDATA[Article title]]>");
    expect(text).toContain("<![CDATA[Function Concept]]>");
    expect(text).toContain("<![CDATA[The Opening]]>");
    expect(text).toContain("<![CDATA[Pembukaan]]>");
    expect(text).toContain("<![CDATA[1. Al-Fatihah]]>");
    expect(text).not.toContain("Undated article");
  });

  it("replaces source articles after signed article ownership activates", async () => {
    mockReadPublishedLatestArticles.mockReturnValue(
      Effect.succeed({
        articles: [
          {
            authors: [{ name: "Nakafa" }],
            category: "politics",
            categoryTitle: "Politics",
            date: "2026-07-24",
            description: "Published description",
            official: true,
            publicPath: "articles/politics/published",
            slug: "published",
            title: "Published article",
          },
        ],
        managed: true,
      })
    );

    const text = await (await GET()).text();

    expect(text).toContain("<![CDATA[Published article]]>");
    expect(text).not.toContain("<![CDATA[Article title]]>");
    expect(mockGetRuntimeLatestContentRoutePage).not.toHaveBeenCalledWith(
      expect.objectContaining({ section: "articles" })
    );
  });

  it("continues through bounded nonterminal source article pages", async () => {
    mockGetRuntimeLatestContentRoutePage.mockImplementation(
      ({ cursor, locale, section }) => {
        if (locale !== "en" || section !== "articles") {
          return Effect.succeed({ continueCursor: "", isDone: true, page: [] });
        }
        const isSecondPage = cursor === "next";
        const offset = isSecondPage ? 60 : 0;
        const count = isSecondPage ? 40 : 60;
        return Effect.succeed({
          continueCursor: isSecondPage ? "" : "next",
          isDone: isSecondPage,
          page: Array.from({ length: count }, (_, index) => ({
            authors: [{ name: "Nakafa" }],
            date: Date.parse("2026-07-24T00:00:00.000Z") - offset - index,
            locale: "en",
            route: `articles/test/source-${offset + index + 1}`,
            sourcePath: `articles/test/source-${offset + index + 1}`,
            title: `Source ${offset + index + 1}`,
          })),
        });
      }
    );

    const text = await (await GET()).text();

    expect(text).toContain("<![CDATA[Source 100]]>");
    expect(mockGetRuntimeLatestContentRoutePage).toHaveBeenCalledWith({
      cursor: "next",
      limit: 40,
      locale: "en",
      section: "articles",
    });
  });

  it("stops when a source article cursor does not advance", async () => {
    mockGetRuntimeLatestContentRoutePage.mockImplementation(
      ({ cursor, locale }) => {
        if (locale !== "en") {
          return Effect.succeed({ continueCursor: "", isDone: true, page: [] });
        }
        return Effect.succeed({
          continueCursor: cursor ?? "",
          isDone: false,
          page: [],
        });
      }
    );

    const text = await (await GET()).text();

    expect(text).not.toContain("Article title");
    expect(mockGetRuntimeLatestContentRoutePage).toHaveBeenCalledWith({
      cursor: "",
      limit: 100,
      locale: "en",
      section: "articles",
    });
  });

  it("bounds an empty source article cursor chain", async () => {
    mockGetRuntimeLatestContentRoutePage.mockImplementation(({ cursor }) => {
      const nextCursor = cursor === null ? "0" : String(Number(cursor) + 1);
      return Effect.succeed({
        continueCursor: nextCursor,
        isDone: false,
        page: [],
      });
    });

    const text = await (await GET()).text();

    expect(text).not.toContain("Article title");
    expect(mockGetRuntimeLatestContentRoutePage).toHaveBeenCalledTimes(200);
  });

  it("rejects the feed when no active publication exists", async () => {
    mockReadActiveContentIdentity.mockReturnValueOnce(Effect.succeed(null));

    await expect(GET()).rejects.toThrow();
    expect(mockReadPublishedLatestMaterials).not.toHaveBeenCalled();
  });

  it("rejects the feed when the active publication disappears", async () => {
    mockReadActiveContentIdentity
      .mockReturnValueOnce(Effect.succeed({ releaseId: activeReleaseId }))
      .mockReturnValueOnce(Effect.succeed(null));

    await expect(GET()).rejects.toThrow('"actualReleaseId": null');
  });

  it("rejects a feed assembled across different active releases", async () => {
    mockReadPublishedLatestMaterials.mockReturnValue(
      Effect.succeed({ activeReleaseId: "release-a", materials: [] })
    );
    mockReadActiveContentIdentity
      .mockReturnValue(Effect.succeed({ releaseId: "release-a" }))
      .mockReturnValueOnce(Effect.succeed({ releaseId: "release-a" }))
      .mockReturnValueOnce(Effect.succeed({ releaseId: "release-b" }));

    await expect(GET()).rejects.toThrow(
      '"actualReleaseId": "release-b", "expectedReleaseId": "release-a"'
    );
  });
});
