// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/rss.xml/route";

const mockFetchRuntimeQuranSurahs = vi.hoisted(() => vi.fn());
const mockListRuntimeLatestContentRoutes = vi.hoisted(() => vi.fn());
const mockReadPublishedLatestArticles = vi.hoisted(() => vi.fn());
const mockReadPublishedLatestMaterials = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/article/discovery", () => ({
  /** Supplies deterministic published article rows for the RSS route test. */
  readPublishedLatestArticles: mockReadPublishedLatestArticles,
}));
vi.mock("@/lib/content/material/discovery", () => ({
  /** Supplies deterministic published material rows for the RSS route test. */
  readPublishedLatestMaterials: mockReadPublishedLatestMaterials,
}));

vi.mock("@/lib/content/runtime/pages", () => ({
  /** Supplies deterministic Quran rows for the RSS route test. */
  fetchRuntimeQuranSurahs: mockFetchRuntimeQuranSurahs,
}));

vi.mock("@/lib/content/runtime/routes", () => ({
  /** Supplies deterministic latest content route rows for the RSS route test. */
  listRuntimeLatestContentRoutes: mockListRuntimeLatestContentRoutes,
}));

vi.mock("@/lib/utils/pages/quran", () => ({
  /** Keeps Quran title rendering local to this route test. */
  getQuranSurahName: () => "Al-Fatihah",
}));

vi.mock("next-intl/server", () => ({
  /** Supplies deterministic translated feed metadata. */
  getTranslations: ({ namespace }: { namespace: string }) =>
    Promise.resolve((key: string) => `${namespace}.${key}`),
}));

describe("rss route", () => {
  beforeEach(() => {
    mockFetchRuntimeQuranSurahs.mockReset();
    mockListRuntimeLatestContentRoutes.mockReset();
    mockReadPublishedLatestArticles.mockReset();
    mockReadPublishedLatestMaterials.mockReset();

    mockFetchRuntimeQuranSurahs.mockResolvedValue([
      {
        name: {
          translation: { en: "The Opening", id: "Pembukaan" },
        },
        number: 1,
      },
    ]);
    mockReadPublishedLatestArticles.mockReturnValue(
      Effect.succeed({ articles: [], managed: false })
    );
    mockReadPublishedLatestMaterials.mockReturnValue(
      Effect.succeed({ managed: false, materials: [] })
    );
    mockListRuntimeLatestContentRoutes.mockImplementation(({ section }) =>
      Effect.succeed(
        section === "articles"
          ? [
              {
                authors: [{ name: "Nakafa" }],
                date: Date.parse("2026-01-01T00:00:00.000Z"),
                locale: "id",
                route: "articles/politics/example",
                title: "Article title",
              },
              {
                authors: [{ name: "Nakafa" }],
                description: "Undated article description",
                locale: "id",
                route: "articles/politics/undated",
                title: "Undated article",
              },
            ]
          : []
      )
    );
  });

  it("serves RSS XML with an explicit feed content type", async () => {
    const response = await GET();
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain(
      "application/rss+xml"
    );
    expect(text).toContain("<rss");
    expect(text).toContain("<![CDATA[Article title]]>");
    expect(text).toContain("<![CDATA[The Opening]]>");
    expect(text).toContain("<![CDATA[Pembukaan]]>");
    expect(text).toContain("<![CDATA[1. Al-Fatihah]]>");
    expect(text).not.toContain("Undated article");
  });

  it("replaces source-backed articles after published ownership activates", async () => {
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
    expect(mockListRuntimeLatestContentRoutes).not.toHaveBeenCalledWith(
      expect.objectContaining({ section: "articles" })
    );
  });

  it("replaces source-backed materials after published ownership activates", async () => {
    mockReadPublishedLatestMaterials.mockReturnValue(
      Effect.succeed({
        managed: true,
        materials: [
          {
            authors: [{ name: "Nabil Akbarazzima Fatih" }],
            date: "2025-04-27",
            description: "Understand functions as input-output relationships.",
            publicPath:
              "subjects/mathematics/function-composition-inverse-function/function-concept",
            title: "Function Concept",
          },
        ],
      })
    );

    const text = await (await GET()).text();

    expect(text).toContain("<![CDATA[Function Concept]]>");
    expect(mockListRuntimeLatestContentRoutes).not.toHaveBeenCalledWith(
      expect.objectContaining({ section: "material" })
    );
  });
});
