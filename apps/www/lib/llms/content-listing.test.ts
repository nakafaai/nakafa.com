// @vitest-environment node

import { Effect, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getContentListingLlmsEntries } from "@/lib/llms/content-listing";

const mockReadPublishedCategoryArticles = vi.hoisted(() => vi.fn());
const mockReadPublishedArticleCategory = vi.hoisted(() => vi.fn());
const activeReleaseId = "release-article";

vi.mock("@/lib/content/article/discovery", () => ({
  readPublishedCategoryArticles: mockReadPublishedCategoryArticles,
}));
vi.mock("@/lib/content/article/category", () => ({
  readPublishedArticleCategory: mockReadPublishedArticleCategory,
}));

beforeEach(() => {
  mockReadPublishedCategoryArticles.mockReset();
  mockReadPublishedArticleCategory.mockReset();
  mockReadPublishedArticleCategory.mockReturnValue(
    Effect.succeed(Option.some({ activeReleaseId, category: "politics" }))
  );
  mockReadPublishedCategoryArticles.mockReturnValue(
    Effect.succeed({
      activeReleaseId,
      articles: [
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
          title:
            "Framing Dynastic Politics in Local Elections within Asian Values",
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
          route: {
            category: "politics",
            slug: "regional-elections-turmoil",
          },
          title:
            "Political Turmoil Ahead of Regional Elections: Politics in Chaos, The People Cry Out",
        },
      ],
    })
  );
});

describe("llms content listing", () => {
  it("builds one bounded signed article listing", async () => {
    const entries = await Effect.runPromise(
      getContentListingLlmsEntries({
        locale: "en",
        route: "articles/politics",
      })
    );

    expect(entries?.map((entry) => entry.route)).toEqual([
      "/articles/politics/dynastic-politics-asian-values",
      "/articles/politics/regional-elections-turmoil",
    ]);
    expect(mockReadPublishedCategoryArticles).toHaveBeenCalledWith(
      "en",
      "politics",
      100,
      activeReleaseId
    );
  });

  it("uses the published owner for an active article category", async () => {
    mockReadPublishedCategoryArticles.mockReturnValue(
      Effect.succeed({
        activeReleaseId,
        articles: [
          {
            authors: [{ name: "Shifna Zihdatal Haq" }],
            category: "politics",
            categoryTitle: "Politics",
            datePublished: "2024-10-27",
            description:
              "The political anomaly in Indonesia as it prepares for the 2024 Regional Elections.",
            official: true,
            publicPath: "articles/politics/regional-elections-turmoil",
            route: {
              category: "politics",
              slug: "regional-elections-turmoil",
            },
            title:
              "Political Turmoil Ahead of Regional Elections: Politics in Chaos, The People Cry Out",
          },
        ],
      })
    );

    await expect(
      Effect.runPromise(
        getContentListingLlmsEntries({
          locale: "en",
          route: "articles/politics",
        })
      )
    ).resolves.toEqual([
      expect.objectContaining({
        route: "/articles/politics/regional-elections-turmoil",
        title:
          "Political Turmoil Ahead of Regional Elections: Politics in Chaos, The People Cry Out",
      }),
    ]);
    expect(mockReadPublishedCategoryArticles).toHaveBeenCalledWith(
      "en",
      "politics",
      100,
      activeReleaseId
    );
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
    expect(mockReadPublishedCategoryArticles).not.toHaveBeenCalled();
    expect(mockReadPublishedArticleCategory).not.toHaveBeenCalled();
  });

  it("rejects a valid route segment absent from the signed catalog", async () => {
    mockReadPublishedArticleCategory.mockReturnValue(
      Effect.succeed(Option.none())
    );

    await expect(
      Effect.runPromise(
        getContentListingLlmsEntries({
          locale: "de",
          route: "articles/fehlend",
        })
      )
    ).resolves.toBeNull();
    expect(mockReadPublishedCategoryArticles).not.toHaveBeenCalled();
  });
});
