// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { vi } from "vitest";
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
  it.effect("builds one bounded signed article listing", () =>
    Effect.gen(function* () {
      const entries = yield* getContentListingLlmsEntries({
        locale: "en",
        route: "articles/politics",
      });

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
    })
  );

  it.effect("uses the published owner for an active article category", () =>
    Effect.gen(function* () {
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

      const entries = yield* getContentListingLlmsEntries({
        locale: "en",
        route: "articles/politics",
      });

      expect(entries).toEqual([
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
    })
  );

  it.effect("rejects unsupported listing routes without catalog reads", () =>
    Effect.gen(function* () {
      const routes = [
        "articles",
        "articles/Invalid_Category",
        "articles/politics/extra",
        "curriculum/merdeka/class-10/mathematics/integral",
      ];

      const entries = yield* Effect.forEach(routes, (route) =>
        getContentListingLlmsEntries({ locale: "en", route })
      );

      expect(entries).toEqual([null, null, null, null]);
      expect(mockReadPublishedCategoryArticles).not.toHaveBeenCalled();
      expect(mockReadPublishedArticleCategory).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "rejects a valid route segment absent from the signed catalog",
    () =>
      Effect.gen(function* () {
        mockReadPublishedArticleCategory.mockReturnValue(
          Effect.succeed(Option.none())
        );

        const entries = yield* getContentListingLlmsEntries({
          locale: "de",
          route: "articles/fehlend",
        });

        expect(entries).toBeNull();
        expect(mockReadPublishedCategoryArticles).not.toHaveBeenCalled();
      })
  );
});
