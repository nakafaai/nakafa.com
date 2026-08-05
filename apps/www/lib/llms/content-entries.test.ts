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

const mockGetArtifactPage = vi.hoisted(() => vi.fn());
const mockReadPublishedArticleBucket = vi.hoisted(() => vi.fn());
const mockReadPublishedArticleBuckets = vi.hoisted(() => vi.fn());
const mockReadPublishedMaterialBucket = vi.hoisted(() => vi.fn());
const mockReadMaterialInventory = vi.hoisted(() => vi.fn());
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

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRouteArtifactPage: mockGetArtifactPage,
}));

const routeRows = [
  {
    markdown: false,
    route: "articles/politics/flawed-legal-geopolitics",
    section: "articles",
  },
  {
    description:
      "How Asian values are used to justify dynastic politics in Indonesian local elections, and why that argument matters for democracy.",
    markdown: true,
    route: "articles/politics/dynastic-politics-asian-values",
    section: "articles",
    title: "Framing Dynastic Politics in Local Elections within Asian Values",
  },
  {
    description:
      "The political anomaly in Indonesia as it prepares for the 2024 Regional Elections.",
    markdown: true,
    route: "articles/politics/regional-elections-turmoil",
    section: "articles",
    title:
      "Political Turmoil Ahead of Regional Elections: Politics in Chaos, The People Cry Out",
  },
  {
    description:
      "Understand green chemistry as the design of chemical products and processes that reduce hazards, waste, and energy use from the start.",
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

/** Builds one published material summary from a real projection fixture. */
function makeMaterialSummary(projection: MaterialLessonProjection) {
  return {
    authors: projection.metadata.authors.map(({ name }) => ({ name })),
    date: projection.metadata.date,
    description: projection.metadata.description,
    publicPath: projection.publicPath,
    title: projection.metadata.title,
  };
}

beforeEach(() => {
  mockGetArtifactPage.mockReset();
  mockReadPublishedArticleBucket.mockReset();
  mockReadPublishedArticleBuckets.mockReset();
  mockReadPublishedMaterialBucket.mockReset();
  mockReadMaterialInventory.mockReset();
  mockReadPublishedArticleBuckets.mockReturnValue(
    Effect.succeed({ articleCount: 0, buckets: [], managed: false })
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
});

describe("llms content entries", () => {
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
      "/articles/politics/dynastic-politics-asian-values",
      "/articles/politics/regional-elections-turmoil",
      `/${previewProjection.publicPath}`,
      "/quran/1",
    ]);
    expect(mockGetArtifactPage).toHaveBeenCalledWith({
      locale: "en",
      page: 0,
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
            authors: [{ name: "Shifna Zihdatal Haq" }],
            category: "politics",
            categoryTitle: "Politics",
            date: "2024-08-08",
            description:
              "How Asian values are used to justify dynastic politics in Indonesian local elections, and why that argument matters for democracy.",
            official: true,
            publicPath: "articles/politics/dynastic-politics-asian-values",
            slug: "dynastic-politics-asian-values",
            title:
              "Framing Dynastic Politics in Local Elections within Asian Values",
          },
          {
            authors: [{ name: "Shifna Zihdatal Haq" }],
            category: "politics",
            categoryTitle: "Politics",
            date: "2024-10-27",
            description:
              "The political anomaly in Indonesia as it prepares for the 2024 Regional Elections.",
            official: false,
            publicPath: "articles/politics/regional-elections-turmoil",
            slug: "regional-elections-turmoil",
            title:
              "Political Turmoil Ahead of Regional Elections: Politics in Chaos, The People Cry Out",
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
    expect(mockGetArtifactPage).not.toHaveBeenCalled();
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
    expect(mockGetArtifactPage).not.toHaveBeenCalled();
    expect(mockReadPublishedMaterialBucket).toHaveBeenCalledWith(
      "en",
      "abc",
      activeMaterialReleaseId
    );
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

    mockGetArtifactPage.mockReturnValueOnce(Effect.succeed(null));

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

    mockReadPublishedArticleBuckets.mockReturnValue(
      Effect.succeed({
        articleCount: 0,
        buckets: [],
        managed: false,
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
