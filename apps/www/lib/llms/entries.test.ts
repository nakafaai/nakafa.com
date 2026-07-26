// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_URL } from "@/lib/llms/constants";
import {
  getContentListingLlmsEntries,
  getContentPageLlmsEntries,
  getLlmsSections,
  getSiteLlmsEntries,
  isLlmsSection,
  type LlmsEntry,
} from "@/lib/llms/entries";

const mockGetArtifactPage = vi.hoisted(() => vi.fn());
const mockGetParentPage = vi.hoisted(() => vi.fn());
const mockReadPublishedArticleBucket = vi.hoisted(() => vi.fn());
const mockReadPublishedArticleBuckets = vi.hoisted(() => vi.fn());
const mockReadPublishedCategoryArticles = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/article/discovery", () => ({
  readPublishedArticleBucket: mockReadPublishedArticleBucket,
  readPublishedCategoryArticles: mockReadPublishedCategoryArticles,
}));

vi.mock("@/lib/content/article/sitemap", () => ({
  readPublishedArticleBuckets: mockReadPublishedArticleBuckets,
}));

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRouteArtifactPage: mockGetArtifactPage,
  getRuntimeContentRouteParentPage: mockGetParentPage,
}));

const routeRows = [
  {
    description: "Draft",
    markdown: false,
    route: "articles/politics/draft",
    section: "articles",
    title: "Draft",
  },
  {
    description: "A short article fixture.",
    markdown: true,
    route: "articles/politics/aaa-short-fixture",
    section: "articles",
    title: "A Short Fixture",
  },
  {
    description: "Power is passed down under the guise of local values.",
    markdown: true,
    route: "articles/politics/dynastic-politics-asian-values",
    section: "articles",
    title: "Dynastic Politics and Asian Values",
  },
  {
    description: "Green Chemistry",
    markdown: true,
    route: "subjects/chemistry/green-chemistry/definition",
    section: "material",
    title: "Definition of Green Chemistry",
  },
  {
    description: "Quran index",
    markdown: true,
    route: "quran/1",
    section: "quran",
    title: "Al-Quran",
  },
];

beforeEach(() => {
  mockGetArtifactPage.mockReset();
  mockGetParentPage.mockReset();
  mockReadPublishedArticleBucket.mockReset();
  mockReadPublishedArticleBuckets.mockReset();
  mockReadPublishedCategoryArticles.mockReset();
  mockReadPublishedArticleBuckets.mockReturnValue(
    Effect.succeed({ articleCount: 0, buckets: [], managed: false })
  );
  mockReadPublishedCategoryArticles.mockReturnValue(
    Effect.succeed({ articles: [], managed: false })
  );
  mockGetArtifactPage.mockImplementation(({ locale, page, section }) =>
    Effect.succeed({
      locale,
      page,
      routeCount: routeRows.length,
      routes: routeRows.filter((route) => route.section === section),
      section,
      syncedAt: 1,
    })
  );
  mockGetParentPage.mockImplementation(({ parentRoute }) =>
    Effect.succeed({
      continueCursor: null,
      isDone: true,
      page: routeRows.filter((row) => row.route.startsWith(`${parentRoute}/`)),
    })
  );
});

describe("llms entries", () => {
  it("classifies supported sections", () => {
    expect(isLlmsSection("articles")).toBe(true);
    expect(isLlmsSection("unknown")).toBe(false);
    expect(isLlmsSection(undefined)).toBe(false);
    expect(getLlmsSections()).toEqual([
      "articles",
      "material",
      "quran",
      "site",
    ]);
  });

  it("localizes static site routes", () => {
    const englishEntries = getSiteLlmsEntries("en");
    const indonesianEntries = getSiteLlmsEntries("id");
    const englishCurriculum = englishEntries.find(
      (entry) => entry.route === "/curriculum"
    );
    const indonesianCurriculum = indonesianEntries.find(
      (entry) => entry.route === "/kurikulum"
    );

    expect(englishCurriculum).toMatchObject({
      href: `${BASE_URL}/en/curriculum`,
      section: "site",
      title: "Curriculum",
    });
    expect(indonesianCurriculum).toMatchObject({
      href: `${BASE_URL}/id/kurikulum`,
      section: "site",
      title: "Kurikulum",
    });
    expect(englishEntries.map((entry) => entry.route)).toEqual([
      "/curriculum",
      "/privacy-policy",
      "/security-policy",
      "/terms-of-service",
    ]);
    expect(englishEntries.some((entry) => entry.route === "/")).toBe(false);
    expect(englishEntries.some((entry) => entry.route === "/contributor")).toBe(
      false
    );
    expect(englishEntries.some((entry) => entry.route === "/search")).toBe(
      false
    );
  });

  it("builds sorted page entries from markdown route rows", async () => {
    const entryGroups = await Effect.runPromise(
      Effect.all([
        getContentPageLlmsEntries({
          locale: "en",
          page: 0,
          section: "articles",
        }),
        getContentPageLlmsEntries({
          locale: "en",
          page: 0,
          section: "material",
        }),
        getContentPageLlmsEntries({
          locale: "en",
          page: 0,
          section: "quran",
        }),
      ])
    );
    const entries: LlmsEntry[] = [];

    for (const group of entryGroups) {
      expect(group).not.toBeNull();

      if (group === null) {
        continue;
      }

      entries.push(...group);
    }

    expect(entries.map((entry) => entry.route)).toEqual([
      "/articles/politics/aaa-short-fixture",
      "/articles/politics/dynastic-politics-asian-values",
      "/subjects/chemistry/green-chemistry/definition",
      "/quran/1",
    ]);
    expect(entries[1]).toEqual({
      description: "Power is passed down under the guise of local values.",
      href: `${BASE_URL}/en/articles/politics/dynastic-politics-asian-values.md`,
      route: "/articles/politics/dynastic-politics-asian-values",
      section: "articles",
      segments: ["articles", "politics", "dynastic-politics-asian-values"],
      title: "Dynastic Politics and Asian Values",
    });
    expect(mockGetArtifactPage).toHaveBeenCalledWith({
      locale: "en",
      page: 0,
      section: "articles",
    });
  });

  it("builds bounded article listing entries", async () => {
    const entries = await Effect.runPromise(
      getContentListingLlmsEntries({
        locale: "en",
        route: "articles/politics",
      })
    );

    expect(entries?.map((entry) => entry.route)).toEqual([
      "/articles/politics/aaa-short-fixture",
      "/articles/politics/dynastic-politics-asian-values",
    ]);
    expect(mockGetParentPage).toHaveBeenCalledWith({
      cursor: null,
      kind: "article",
      limit: 100,
      locale: "en",
      order: "date-desc",
      parentRoute: "articles/politics",
      section: "articles",
    });
  });

  it("uses published article partitions after ownership activates", async () => {
    mockReadPublishedArticleBuckets.mockReturnValue(
      Effect.succeed({
        articleCount: 1,
        buckets: ["abc"],
        managed: true,
      })
    );
    mockReadPublishedArticleBucket.mockReturnValue(
      Effect.succeed({
        articles: [
          {
            authors: [{ name: "Nakafa" }],
            category: "politics",
            categoryTitle: "Politics",
            date: "2026-07-24",
            description: "Published article",
            official: true,
            publicPath: "articles/politics/published",
            slug: "published",
            title: "Published",
          },
          {
            authors: [{ name: "Nakafa" }],
            category: "politics",
            categoryTitle: "Politics",
            date: "2026-07-23",
            description: "Earlier article",
            official: false,
            publicPath: "articles/politics/aaa-earlier",
            slug: "aaa-earlier",
            title: "Earlier",
          },
        ],
        managed: true,
      })
    );

    await expect(
      Effect.runPromise(
        getContentPageLlmsEntries({
          locale: "en",
          page: 0,
          section: "articles",
        })
      )
    ).resolves.toEqual([
      {
        description: "Earlier article",
        href: `${BASE_URL}/en/articles/politics/aaa-earlier.md`,
        route: "/articles/politics/aaa-earlier",
        section: "articles",
        segments: ["articles", "politics", "aaa-earlier"],
        title: "Earlier",
      },
      {
        description: "Published article",
        href: `${BASE_URL}/en/articles/politics/published.md`,
        route: "/articles/politics/published",
        section: "articles",
        segments: ["articles", "politics", "published"],
        title: "Published",
      },
    ]);
    expect(mockGetArtifactPage).not.toHaveBeenCalled();
  });

  it("uses contract-valid published categories outside the source taxonomy", async () => {
    mockReadPublishedCategoryArticles.mockReturnValue(
      Effect.succeed({
        articles: [
          {
            authors: [{ name: "Nakafa" }],
            category: "public-affairs",
            categoryTitle: "Public Affairs",
            date: "2026-07-24",
            description: "",
            official: true,
            publicPath: "articles/public-affairs/published",
            slug: "published",
            title: "Published",
          },
        ],
        managed: true,
      })
    );

    await expect(
      Effect.runPromise(
        getContentListingLlmsEntries({
          locale: "en",
          route: "articles/public-affairs",
        })
      )
    ).resolves.toEqual([
      expect.objectContaining({
        route: "/articles/public-affairs/published",
        title: "Published",
      }),
    ]);
    expect(mockReadPublishedCategoryArticles).toHaveBeenCalledWith(
      "en",
      "public-affairs",
      100
    );
    expect(mockGetParentPage).not.toHaveBeenCalled();
  });

  it("rejects unsupported listing routes without catalog reads", async () => {
    const routes = [
      "articles",
      "articles/Invalid_Category",
      "articles/politics/extra",
      "curriculum/merdeka/class-10/mathematics/integral",
    ];

    for (const route of routes) {
      await expect(
        Effect.runPromise(getContentListingLlmsEntries({ locale: "en", route }))
      ).resolves.toBeNull();
    }

    expect(mockGetParentPage).not.toHaveBeenCalled();
  });

  it("distinguishes empty artifact pages from missing pages", async () => {
    mockGetArtifactPage.mockReturnValueOnce(
      Effect.succeed({
        locale: "en",
        page: 99,
        routeCount: 0,
        routes: [],
        section: "articles",
        syncedAt: 1,
      })
    );

    await expect(
      Effect.runPromise(
        getContentPageLlmsEntries({
          locale: "en",
          page: 99,
          section: "articles",
        })
      )
    ).resolves.toEqual([]);

    mockGetArtifactPage.mockReturnValueOnce(Effect.succeed(null));

    await expect(
      Effect.runPromise(
        getContentPageLlmsEntries({
          locale: "en",
          page: 404,
          section: "articles",
        })
      )
    ).resolves.toBeNull();
  });

  it("rejects absent or changed published partitions without source fallback", async () => {
    mockReadPublishedArticleBuckets.mockReturnValue(
      Effect.succeed({
        articleCount: 1,
        buckets: ["abc"],
        managed: true,
      })
    );

    await expect(
      Effect.runPromise(
        getContentPageLlmsEntries({
          locale: "en",
          page: 1,
          section: "articles",
        })
      )
    ).resolves.toBeNull();

    mockReadPublishedArticleBucket.mockReturnValue(
      Effect.succeed({ articles: null, managed: true })
    );
    await expect(
      Effect.runPromise(
        getContentPageLlmsEntries({
          locale: "en",
          page: 0,
          section: "articles",
        })
      )
    ).resolves.toBeNull();

    mockReadPublishedArticleBucket.mockReturnValue(
      Effect.succeed({ articles: [], managed: false })
    );
    await expect(
      Effect.runPromise(
        getContentPageLlmsEntries({
          locale: "en",
          page: 0,
          section: "articles",
        })
      )
    ).resolves.toBeNull();
    expect(mockGetArtifactPage).not.toHaveBeenCalled();
  });
});
