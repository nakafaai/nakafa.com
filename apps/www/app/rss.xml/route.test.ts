// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/rss.xml/route";

const mockFetchRuntimeQuranSurahs = vi.hoisted(() => vi.fn());
const mockGetRuntimeLatestContentRoutePage = vi.hoisted(() => vi.fn());
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
  getRuntimeLatestContentRoutePage: mockGetRuntimeLatestContentRoutePage,
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
    mockGetRuntimeLatestContentRoutePage.mockReset();
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
      Effect.succeed({
        claimedContentKeys: [],
        managed: false,
        materials: [],
      })
    );
    mockGetRuntimeLatestContentRoutePage.mockImplementation(({ section }) =>
      Effect.succeed({
        continueCursor: "",
        isDone: true,
        page:
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
            : [],
      })
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
    expect(mockGetRuntimeLatestContentRoutePage).not.toHaveBeenCalledWith(
      expect.objectContaining({ section: "articles" })
    );
  });

  it("replaces source-backed materials after published ownership activates", async () => {
    mockReadPublishedLatestMaterials.mockReturnValue(
      Effect.succeed({
        claimedContentKeys: [],
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
    expect(mockGetRuntimeLatestContentRoutePage).not.toHaveBeenCalledWith(
      expect.objectContaining({ section: "material" })
    );
  });

  it("merges exact material ownership without stale source routes", async () => {
    const sourcePath =
      "material/lesson/mathematics/function-composition-inverse-function/function-concept";
    mockReadPublishedLatestMaterials.mockReturnValue(
      Effect.succeed({
        claimedContentKeys: [sourcePath],
        managed: false,
        materials: [
          {
            authors: [{ name: "Nakafa" }],
            date: "2026-07-24",
            description:
              "Understand functions as magic machines with interactive examples. Learn f(x) notation, input-output relationships, and the one-to-one rule.",
            publicPath:
              "subjects/mathematics/function-composition-inverse-function/function-concept",
            sourcePath,
            title: "Function Concept",
          },
        ],
      })
    );
    mockGetRuntimeLatestContentRoutePage.mockImplementation(({ section }) =>
      Effect.succeed({
        continueCursor: "",
        isDone: true,
        page:
          section === "material"
            ? [
                {
                  authors: [{ name: "Nakafa" }],
                  locale: "en",
                  route: "subjects/mathematics/undated/concept",
                  sourcePath: "material/lesson/mathematics/undated/concept",
                  title: "Undated Material",
                },
                {
                  authors: [{ name: "Nakafa" }],
                  date: Date.parse("2026-07-23T00:00:00.000Z"),
                  locale: "en",
                  route:
                    "subjects/mathematics/function-composition-inverse-function/old-function-concept",
                  sourcePath,
                  title: "Function Concept",
                },
                {
                  authors: [{ name: "Nakafa" }],
                  date: Date.parse("2026-07-22T00:00:00.000Z"),
                  locale: "en",
                  route: "subjects/mathematics/logarithms/definition",
                  sourcePath:
                    "material/lesson/mathematics/logarithms/definition",
                  title: "Logarithm Definition",
                },
              ]
            : [],
      })
    );

    const text = await (await GET()).text();

    expect(text).toContain(
      "subjects/mathematics/function-composition-inverse-function/function-concept"
    );
    expect(text).toContain("<![CDATA[Logarithm Definition]]>");
    expect(text).not.toContain(
      "subjects/mathematics/function-composition-inverse-function/old-function-concept"
    );
  });

  it("refills source materials after exact owners consume the first page", async () => {
    const claimed = Array.from(
      { length: 64 },
      (_, index) => `material/lesson/test/claimed-${index + 1}`
    );
    mockReadPublishedLatestMaterials.mockReturnValue(
      Effect.succeed({
        claimedContentKeys: claimed,
        managed: false,
        materials: [],
      })
    );
    mockGetRuntimeLatestContentRoutePage.mockImplementation(
      ({ cursor, locale, section }) => {
        if (locale !== "en" || section !== "material") {
          return Effect.succeed({
            continueCursor: "",
            isDone: true,
            page: [],
          });
        }
        if (cursor === "next") {
          return Effect.succeed({
            continueCursor: "",
            isDone: true,
            page: Array.from({ length: 64 }, (_, index) => ({
              authors: [{ name: "Nakafa" }],
              date: Date.parse("2026-07-22T00:00:00.000Z") - index,
              locale: "en",
              route: `subjects/test/refill-${index + 1}`,
              sourcePath: `material/lesson/test/refill-${index + 1}`,
              title: `Refill ${index + 1}`,
            })),
          });
        }
        return Effect.succeed({
          continueCursor: "next",
          isDone: false,
          page: [
            ...claimed.map((sourcePath, index) => ({
              authors: [{ name: "Nakafa" }],
              date: Date.parse("2026-07-24T00:00:00.000Z") - index,
              locale: "en",
              route: `subjects/test/claimed-${index + 1}`,
              sourcePath,
              title: `Claimed ${index + 1}`,
            })),
            ...Array.from({ length: 36 }, (_, index) => ({
              authors: [{ name: "Nakafa" }],
              date: Date.parse("2026-07-23T00:00:00.000Z") - index,
              locale: "en",
              route: `subjects/test/retained-${index + 1}`,
              sourcePath: `material/lesson/test/retained-${index + 1}`,
              title: `Retained ${index + 1}`,
            })),
          ],
        });
      }
    );

    const text = await (await GET()).text();

    expect(text).toContain("<![CDATA[Retained 36]]>");
    expect(text).toContain("<![CDATA[Refill 64]]>");
    expect(text).not.toContain("<![CDATA[Claimed 1]]>");
    expect(mockGetRuntimeLatestContentRoutePage).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: "next",
        limit: 100,
        locale: "en",
        section: "material",
      })
    );
  });

  it("stops source pagination at the requested feed bound", async () => {
    mockReadPublishedLatestMaterials.mockReturnValue(
      Effect.succeed({
        claimedContentKeys: [],
        managed: false,
        materials: Array.from({ length: 100 }, (_, index) => ({
          authors: [{ name: "Nakafa" }],
          date: "2026-07-24",
          publicPath: `subjects/test/published-${index + 1}`,
          sourcePath: `material/lesson/test/published-${index + 1}`,
          title: `Published ${index + 1}`,
        })),
      })
    );
    mockGetRuntimeLatestContentRoutePage.mockReturnValue(
      Effect.succeed({
        continueCursor: "more",
        isDone: false,
        page: [],
      })
    );

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mockGetRuntimeLatestContentRoutePage).toHaveBeenCalledTimes(2);
    expect(mockGetRuntimeLatestContentRoutePage).not.toHaveBeenCalledWith(
      expect.objectContaining({ section: "material" })
    );
  });
});
