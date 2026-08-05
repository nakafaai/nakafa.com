// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getContentListingLlmsEntries } from "@/lib/llms/content-listing";

const mockReadPublishedCategoryArticles = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/article/discovery", () => ({
  readPublishedCategoryArticles: mockReadPublishedCategoryArticles,
}));

beforeEach(() => {
  mockReadPublishedCategoryArticles.mockReset();
  mockReadPublishedCategoryArticles.mockReturnValue(
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
      100
    );
  });

  it("uses the published owner for an active article category", async () => {
    mockReadPublishedCategoryArticles.mockReturnValue(
      Effect.succeed({
        articles: [
          {
            authors: [{ name: "Shifna Zihdatal Haq" }],
            category: "politics",
            categoryTitle: "Politics",
            date: "2024-10-27",
            description:
              "The political anomaly in Indonesia as it prepares for the 2024 Regional Elections.",
            official: true,
            publicPath: "articles/politics/regional-elections-turmoil",
            slug: "regional-elections-turmoil",
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
      100
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
  });
});
