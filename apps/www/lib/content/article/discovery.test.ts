// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import {
  readPublishedArticleBucket,
  readPublishedCategoryArticles,
  readPublishedLatestArticles,
} from "@/lib/content/article/discovery";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-article");
const localeCases = [
  {
    appLocale: "en",
    categoryRoute: "politics",
    categoryTitle: "Politics",
    articleRoute: "regional-elections-turmoil",
  },
  {
    appLocale: "id",
    categoryRoute: "politics",
    categoryTitle: "Politik",
    articleRoute: "regional-elections-turmoil",
  },
  {
    appLocale: "de",
    categoryRoute: "politik",
    categoryTitle: "Politik",
    articleRoute: "turbulenzen-vor-regionalwahlen",
  },
] as const;

vi.mock("@/lib/content/runtime/query", async () => {
  const { createTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    readRuntimeQuery: createTestRuntimeQuery(runtimeQueryMock),
  };
});

/** Builds one source-owned locale summary returned by Convex discovery. */
function articleSummary(selected: (typeof localeCases)[number]) {
  const publicPath = `articles/${selected.categoryRoute}/${selected.articleRoute}`;
  return {
    authors: [{ name: "Nakafa" }],
    category: "politics",
    categoryTitle: selected.categoryTitle,
    ...(selected.appLocale === "id" ? { dateModified: "2026-08-22" } : {}),
    datePublished: selected.appLocale === "de" ? "2026-08-22" : "2025-06-05",
    ...(selected.appLocale === "de"
      ? {}
      : { description: "Reviewed article summary." }),
    official: false,
    publicPath,
    route: {
      category: selected.categoryRoute,
      slug: selected.articleRoute,
    },
    title: `Article ${selected.appLocale}`,
  };
}

describe("published article discovery", () => {
  beforeEach(() => {
    runtimeQueryMock.mockReset();
  });

  it.effect.each(localeCases)(
    "decodes $appLocale bucket, latest, and category reads from one active release",
    (selected) =>
      Effect.gen(function* () {
        const summary = articleSummary(selected);
        runtimeQueryMock
          .mockResolvedValueOnce({
            activeReleaseId,
            articles: [summary],
            managed: true,
          })
          .mockResolvedValueOnce({
            activeReleaseId,
            articles: [summary],
            managed: true,
          })
          .mockResolvedValueOnce({
            activeReleaseId,
            articles: [summary],
            managed: true,
          });

        const [bucket, latest, category] = yield* Effect.all(
          [
            readPublishedArticleBucket(
              selected.appLocale,
              "abc",
              activeReleaseId
            ),
            readPublishedLatestArticles(
              selected.appLocale,
              10,
              activeReleaseId
            ),
            readPublishedCategoryArticles(
              selected.appLocale,
              "politics",
              10,
              activeReleaseId
            ),
          ],
          { concurrency: 1 }
        );

        expect(bucket).toMatchObject({
          activeReleaseId,
          articles: [{ publicPath: summary.publicPath }],
        });
        expect(latest).toMatchObject({
          activeReleaseId,
          articles: [{ route: summary.route }],
        });
        expect(category).toMatchObject({
          activeReleaseId,
          articles: [{ categoryTitle: selected.categoryTitle }],
        });
        for (const result of [bucket, latest, category]) {
          const article = result.articles?.[0];
          expect(article).toBeDefined();
          if (selected.appLocale === "de") {
            expect(article).not.toHaveProperty("description");
          } else {
            expect(article).toHaveProperty(
              "description",
              "Reviewed article summary."
            );
          }
        }
        expect(runtimeQueryMock).toHaveBeenNthCalledWith(1, expect.anything(), {
          appLocale: selected.appLocale,
          bucket: "abc",
        });
        expect(runtimeQueryMock).toHaveBeenNthCalledWith(2, expect.anything(), {
          appLocale: selected.appLocale,
          limit: 10,
        });
        expect(runtimeQueryMock).toHaveBeenNthCalledWith(3, expect.anything(), {
          appLocale: selected.appLocale,
          category: "politics",
          limit: 10,
        });
      })
  );

  it.effect.each(localeCases)(
    "rejects $appLocale discovery from a different active release",
    (selected) =>
      Effect.gen(function* () {
        runtimeQueryMock.mockResolvedValueOnce({
          activeReleaseId: ReleaseIdSchema.make("release-next"),
          articles: [articleSummary(selected)],
          managed: true,
        });

        const error = yield* readPublishedLatestArticles(
          selected.appLocale,
          10,
          activeReleaseId
        ).pipe(Effect.flip);
        expect(error).toMatchObject({
          _tag: "PublishedReleaseMismatchError",
          expectedReleaseId: activeReleaseId,
        });
      })
  );

  it.effect(
    "rejects unmanaged, malformed, and unavailable discovery results",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock
          .mockResolvedValueOnce({
            activeReleaseId,
            articles: [],
            managed: false,
          })
          .mockResolvedValueOnce({
            activeReleaseId,
            articles: [
              {
                ...articleSummary(localeCases[0]),
                datePublished: "not-a-date",
              },
            ],
            managed: true,
          })
          .mockRejectedValueOnce(new Error("runtime unavailable"));

        const unmanaged = yield* readPublishedLatestArticles("en", 10).pipe(
          Effect.flip
        );
        const malformed = yield* readPublishedLatestArticles("en", 10).pipe(
          Effect.flip
        );
        const unavailable = yield* readPublishedLatestArticles("en", 10).pipe(
          Effect.flip
        );

        expect(unmanaged).toMatchObject({ _tag: "PublishedProjectionError" });
        expect(malformed).toMatchObject({ _tag: "PublishedProjectionError" });
        expect(unavailable).toMatchObject({ _tag: "TestRuntimeQueryError" });
      })
  );

  it.effect(
    "distinguishes unmanaged, inactive, and absent discovery partitions",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock
          .mockResolvedValueOnce({
            activeReleaseId,
            articles: null,
            managed: false,
          })
          .mockResolvedValueOnce({
            activeReleaseId: null,
            articles: null,
            managed: true,
          })
          .mockResolvedValueOnce({
            activeReleaseId,
            articles: null,
            managed: true,
          })
          .mockResolvedValueOnce({
            activeReleaseId: null,
            articles: [],
            managed: true,
          })
          .mockResolvedValueOnce({
            activeReleaseId,
            articles: [],
            managed: false,
          })
          .mockResolvedValueOnce({
            activeReleaseId: null,
            articles: [],
            managed: true,
          });

        const unmanagedBucket = yield* readPublishedArticleBucket(
          "en",
          "abc"
        ).pipe(Effect.flip);
        const inactiveBucket = yield* readPublishedArticleBucket(
          "en",
          "abc"
        ).pipe(Effect.flip);
        const absentBucket = yield* readPublishedArticleBucket("en", "abc");
        const inactiveLatest = yield* readPublishedLatestArticles(
          "en",
          10
        ).pipe(Effect.flip);
        const unmanagedCategory = yield* readPublishedCategoryArticles(
          "en",
          "politics",
          10
        ).pipe(Effect.flip);
        const inactiveCategory = yield* readPublishedCategoryArticles(
          "en",
          "politics",
          10
        ).pipe(Effect.flip);

        expect(unmanagedBucket).toMatchObject({
          _tag: "PublishedProjectionError",
        });
        expect(inactiveBucket).toMatchObject({
          _tag: "PublishedProjectionError",
        });
        expect(absentBucket).toEqual({ activeReleaseId, articles: null });
        expect(inactiveLatest).toMatchObject({
          _tag: "PublishedProjectionError",
        });
        expect(unmanagedCategory).toMatchObject({
          _tag: "PublishedProjectionError",
        });
        expect(inactiveCategory).toMatchObject({
          _tag: "PublishedProjectionError",
        });
      })
  );
});
