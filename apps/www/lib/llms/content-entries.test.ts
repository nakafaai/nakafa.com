// @vitest-environment node
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_URL } from "@/lib/llms/constants";
import { getContentPageLlmsEntries } from "@/lib/llms/content-entries";
import type { LlmsEntry } from "@/lib/llms/entries";
import {
  previewNextProjection,
  previewProjection,
} from "@/test/content-preview";

const mockReadPublishedArticleBucket = vi.hoisted(() => vi.fn());
const mockReadPublishedArticleBuckets = vi.hoisted(() => vi.fn());
const mockReadPublishedMaterialBucket = vi.hoisted(() => vi.fn());
const mockReadMaterialInventory = vi.hoisted(() => vi.fn());
const mockReadQuranPageEntries = vi.hoisted(() => vi.fn());
const activeArticleReleaseId = "release-article";
const activeMaterialReleaseId = "release-material";

vi.mock("@/lib/content/article/discovery", () => ({
  readPublishedArticleBucket: mockReadPublishedArticleBucket,
}));

vi.mock("@/lib/content/article/sitemap", () => ({
  readPublishedArticleBuckets: mockReadPublishedArticleBuckets,
}));
vi.mock("@/lib/content/material/discovery", () => ({
  readPublishedMaterialBucket: mockReadPublishedMaterialBucket,
}));
vi.mock("@/lib/llms/material-pages", () => ({
  readMaterialLlmsInventory: mockReadMaterialInventory,
}));
vi.mock("@/lib/llms/quran", () => ({
  readQuranLlmsPageEntries: mockReadQuranPageEntries,
}));

const publishedArticles = [
  {
    authors: [{ name: "Shifna Zihdatal Haq" }],
    category: "politics",
    categoryTitle: "Politics",
    datePublished: "2024-08-08",
    description:
      "How Asian values are used to justify dynastic politics in Indonesian local elections, and why that argument matters for democracy.",
    official: true,
    publicPath: "articles/politics/dynastic-politics-asian-values",
    route: {
      category: "politics",
      slug: "dynastic-politics-asian-values",
    },
    title: "Framing Dynastic Politics in Local Elections within Asian Values",
  },
  {
    authors: [{ name: "Shifna Zihdatal Haq" }],
    category: "politics",
    categoryTitle: "Politics",
    datePublished: "2024-10-27",
    description:
      "The political anomaly in Indonesia as it prepares for the 2024 Regional Elections.",
    official: false,
    publicPath: "articles/politics/regional-elections-turmoil",
    route: { category: "politics", slug: "regional-elections-turmoil" },
    title:
      "Political Turmoil Ahead of Regional Elections: Politics in Chaos, The People Cry Out",
  },
];

/** Builds one published material summary from a real projection fixture. */
function makeMaterialSummary(projection: MaterialLessonProjection) {
  const metadata = projection.metadata;
  return {
    authors: metadata.authors.map(({ name }) => ({ name })),
    dateModified: metadata.dateModified,
    datePublished: metadata.datePublished,
    description: metadata.description,
    publicPath: projection.publicPath,
    title: metadata.title,
  };
}

beforeEach(() => {
  mockReadPublishedArticleBucket.mockReset();
  mockReadPublishedArticleBuckets.mockReset();
  mockReadPublishedMaterialBucket.mockReset();
  mockReadMaterialInventory.mockReset();
  mockReadQuranPageEntries.mockReset();
  mockReadPublishedArticleBuckets.mockReturnValue(
    Effect.succeed({
      activeReleaseId: activeArticleReleaseId,
      articleCount: 2,
      buckets: ["abc"],
    })
  );
  mockReadPublishedArticleBucket.mockReturnValue(
    Effect.succeed({
      activeReleaseId: activeArticleReleaseId,
      articles: publishedArticles,
    })
  );
  mockReadPublishedMaterialBucket.mockReturnValue(
    Effect.succeed({
      activeReleaseId: activeMaterialReleaseId,
      materials: [makeMaterialSummary(previewProjection)],
    })
  );
  mockReadMaterialInventory.mockReturnValue(
    Effect.succeed({
      activeReleaseId: activeMaterialReleaseId,
      buckets: ["abc"],
      pageCount: 1,
      routeCount: 1,
    })
  );
  mockReadQuranPageEntries.mockReturnValue(
    Effect.succeed([
      {
        description: "The Opening",
        href: `${BASE_URL}/en/quran/1.md`,
        route: "/quran/1",
        section: "quran",
        segments: ["quran", "1"],
        title: "Al-Fatihah",
      },
      {
        description: "The Cow",
        href: `${BASE_URL}/en/quran/2.md`,
        route: "/quran/2",
        section: "quran",
        segments: ["quran", "2"],
        title: "Al-Baqarah",
      },
    ])
  );
});

describe("llms content entries", () => {
  it("builds sorted page entries from signed inventories", async () => {
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
      "/articles/politics/dynastic-politics-asian-values",
      "/articles/politics/regional-elections-turmoil",
      `/${previewProjection.publicPath}`,
      "/quran/1",
      "/quran/2",
    ]);
    expect(mockReadQuranPageEntries).toHaveBeenCalledWith("en", 0);
  });

  it("uses one exact signed article partition", async () => {
    mockReadPublishedArticleBuckets.mockReturnValue(
      Effect.succeed({
        activeReleaseId: activeArticleReleaseId,
        articleCount: 2,
        buckets: ["abc"],
      })
    );
    mockReadPublishedArticleBucket.mockReturnValue(
      Effect.succeed({
        activeReleaseId: activeArticleReleaseId,
        articles: publishedArticles,
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
        description:
          "How Asian values are used to justify dynastic politics in Indonesian local elections, and why that argument matters for democracy.",
        href: `${BASE_URL}/en/articles/politics/dynastic-politics-asian-values.md`,
        route: "/articles/politics/dynastic-politics-asian-values",
        section: "articles",
        segments: ["articles", "politics", "dynastic-politics-asian-values"],
        title:
          "Framing Dynastic Politics in Local Elections within Asian Values",
      },
      {
        description:
          "The political anomaly in Indonesia as it prepares for the 2024 Regional Elections.",
        href: `${BASE_URL}/en/articles/politics/regional-elections-turmoil.md`,
        route: "/articles/politics/regional-elections-turmoil",
        section: "articles",
        segments: ["articles", "politics", "regional-elections-turmoil"],
        title:
          "Political Turmoil Ahead of Regional Elections: Politics in Chaos, The People Cry Out",
      },
    ]);
    expect(mockReadQuranPageEntries).not.toHaveBeenCalled();
    expect(mockReadPublishedArticleBucket).toHaveBeenCalledWith(
      "en",
      "abc",
      activeArticleReleaseId
    );
  });

  it("uses published material partitions after ownership activates", async () => {
    mockReadMaterialInventory.mockReturnValue(
      Effect.succeed({
        activeReleaseId: activeMaterialReleaseId,
        buckets: ["abc"],
        pageCount: 1,
        routeCount: 2,
      })
    );
    mockReadPublishedMaterialBucket.mockReturnValue(
      Effect.succeed({
        activeReleaseId: activeMaterialReleaseId,
        materials: [previewProjection, previewNextProjection].map(
          makeMaterialSummary
        ),
      })
    );

    const entries = await Effect.runPromise(
      getContentPageLlmsEntries({
        locale: "en",
        page: 0,
        section: "material",
      })
    );

    expect(entries?.map(({ route }) => route)).toEqual([
      "/subjects/mathematics/function-composition-inverse-function/function-concept",
      "/subjects/mathematics/function-composition-inverse-function/injective-surjective-bijective-function",
    ]);
    expect(mockReadQuranPageEntries).not.toHaveBeenCalled();
    expect(mockReadPublishedMaterialBucket).toHaveBeenCalledWith(
      "en",
      "abc",
      activeMaterialReleaseId
    );
  });

  it("distinguishes an empty signed page from a missing page", async () => {
    mockReadQuranPageEntries.mockReturnValueOnce(Effect.succeed([]));

    await expect(
      Effect.runPromise(
        getContentPageLlmsEntries({
          locale: "en",
          page: 99,
          section: "quran",
        })
      )
    ).resolves.toEqual([]);

    mockReadQuranPageEntries.mockReturnValueOnce(Effect.succeed(null));

    await expect(
      Effect.runPromise(
        getContentPageLlmsEntries({
          locale: "en",
          page: 404,
          section: "quran",
        })
      )
    ).resolves.toBeNull();

    await expect(
      Effect.runPromise(
        getContentPageLlmsEntries({
          locale: "en",
          page: 404,
          section: "material",
        })
      )
    ).resolves.toBeNull();
  });

  it("rejects absent or changed published partitions without source fallback", async () => {
    mockReadPublishedArticleBuckets.mockReturnValue(
      Effect.succeed({
        activeReleaseId: activeArticleReleaseId,
        articleCount: 1,
        buckets: ["abc"],
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
      Effect.succeed({
        activeReleaseId: activeArticleReleaseId,
        articles: null,
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
    ).resolves.toBeNull();

    mockReadPublishedArticleBucket.mockReturnValue(
      Effect.succeed({
        activeReleaseId: activeArticleReleaseId,
        articles: [],
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
    ).resolves.toEqual([]);
    expect(mockReadQuranPageEntries).not.toHaveBeenCalled();
    mockReadMaterialInventory.mockReturnValue(
      Effect.succeed({
        activeReleaseId: activeMaterialReleaseId,
        buckets: ["abc"],
        pageCount: 1,
        routeCount: 1,
      })
    );
    await expect(
      Effect.runPromise(
        getContentPageLlmsEntries({
          locale: "en",
          page: 1,
          section: "material",
        })
      )
    ).resolves.toBeNull();

    mockReadPublishedMaterialBucket
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: activeMaterialReleaseId,
          materials: null,
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: activeMaterialReleaseId,
          materials: [],
        })
      );
    await expect(
      Effect.runPromise(
        getContentPageLlmsEntries({
          locale: "en",
          page: 0,
          section: "material",
        })
      )
    ).resolves.toBeNull();
    await expect(
      Effect.runPromise(
        getContentPageLlmsEntries({
          locale: "en",
          page: 0,
          section: "material",
        })
      )
    ).resolves.toEqual([]);
  });
});
