// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/rss.xml/route";

const mockFetchRuntimeQuranSurahs = vi.hoisted(() => vi.fn());
const mockListRuntimeLatestContentRoutes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/runtime", () => ({
  /** Supplies deterministic Quran rows for the RSS route test. */
  fetchRuntimeQuranSurahs: mockFetchRuntimeQuranSurahs,
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

    mockFetchRuntimeQuranSurahs.mockResolvedValue([
      {
        name: {
          translation: { en: "The Opening" },
        },
        number: 1,
      },
    ]);
    mockListRuntimeLatestContentRoutes.mockReturnValue(
      Effect.succeed([
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
      ])
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
    expect(text).toContain("<![CDATA[1. Al-Fatihah]]>");
    expect(text).not.toContain("Undated article");
  });
});
