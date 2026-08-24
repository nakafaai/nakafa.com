// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    datePublished: selected.appLocale === "de" ? "2026-08-22" : "2025-06-05",
    description: "Reviewed article summary.",
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

  it.each(localeCases)(
    "decodes $appLocale bucket, latest, and category reads from one active release",
    async (selected) => {
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

      const [bucket, latest, category] = await Effect.runPromise(
        Effect.all(
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
        )
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
    }
  );

  it.each(localeCases)(
    "rejects $appLocale discovery from a different active release",
    async (selected) => {
      runtimeQueryMock.mockResolvedValueOnce({
        activeReleaseId: ReleaseIdSchema.make("release-next"),
        articles: [articleSummary(selected)],
        managed: true,
      });

      await expect(
        Effect.runPromise(
          readPublishedLatestArticles(
            selected.appLocale,
            10,
            activeReleaseId
          ).pipe(Effect.flip)
        )
      ).resolves.toMatchObject({
        _tag: "PublishedReleaseMismatchError",
        expectedReleaseId: activeReleaseId,
      });
    }
  );

  it("rejects unmanaged, malformed, and unavailable discovery results", async () => {
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

    await expect(
      Effect.runPromise(readPublishedLatestArticles("en", 10).pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
    await expect(
      Effect.runPromise(readPublishedLatestArticles("en", 10).pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
    await expect(
      Effect.runPromise(readPublishedLatestArticles("en", 10).pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "TestRuntimeQueryError" });
  });
});
