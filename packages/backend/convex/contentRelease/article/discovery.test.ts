import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertRuntimeArticles,
  testLocalizedArticleProjection,
} from "@repo/backend/test/content/runtime";
import { convexTest } from "convex-test";

const bucket = api.contentRelease.article.bucket;
const latest = api.contentRelease.article.latest;
const listing = api.contentRelease.article.listing;

describe("contentRelease/article/discovery", () => {
  it.each(["en", "id", "de"] as const)(
    "returns newest %s articles and one exact managed partition",
    async (appLocale) => {
      const t = convexTest(schema, convexModules);
      await t.mutation((ctx) =>
        insertRuntimeArticles(ctx, 2, (index) =>
          testLocalizedArticleProjection(index, appLocale)
        )
      );
      const catalog = await t.run((ctx) =>
        ctx.db
          .query("articleCatalog")
          .withIndex(
            "by_slot_and_appLocale_and_datePublished_and_contentKey",
            (index) => index.eq("slot", "blue").eq("appLocale", appLocale)
          )
          .order("desc")
          .take(2)
      );
      const selected = catalog[0];
      if (!selected) {
        throw new Error("Expected one article catalog row.");
      }
      await expect(
        t.query(latest, { appLocale, limit: 1 })
      ).resolves.toMatchObject({
        activeReleaseId: expect.any(String),
        articles: [
          {
            articleSlug: testLocalizedArticleProjection(1, appLocale)
              .articleSlug,
            authors: [{ name: "Nakafa" }],
            category: "politics",
            datePublished: "2026-07-11",
            publicPath: testLocalizedArticleProjection(1, appLocale).publicPath,
            route: {
              category: testLocalizedArticleProjection(1, appLocale)
                .categoryRouteSlug,
              slug: testLocalizedArticleProjection(1, appLocale)
                .articleRouteSlug,
            },
            title: "Article 1",
          },
        ],
        managed: true,
      });
      await expect(
        t.query(listing, {
          appLocale,
          category: "politics",
          limit: 1,
        })
      ).resolves.toMatchObject({
        activeReleaseId: expect.any(String),
        articles: [
          {
            articleSlug: testLocalizedArticleProjection(1, appLocale)
              .articleSlug,
            category: "politics",
            publicPath: testLocalizedArticleProjection(1, appLocale).publicPath,
            route: {
              category: testLocalizedArticleProjection(1, appLocale)
                .categoryRouteSlug,
              slug: testLocalizedArticleProjection(1, appLocale)
                .articleRouteSlug,
            },
          },
        ],
        managed: true,
      });
      await expect(
        t.query(bucket, { appLocale, bucket: selected.bucket })
      ).resolves.toMatchObject({
        activeReleaseId: expect.any(String),
        articles: expect.arrayContaining([
          expect.objectContaining({
            articleSlug: expect.any(String),
            datePublished: expect.any(String),
            publicPath: selected.publicPath,
          }),
        ]),
        managed: true,
      });
    }
  );

  it("distinguishes unmanaged and absent managed partitions", async () => {
    const unmanaged = convexTest(schema, convexModules);
    await expect(
      unmanaged.query(latest, { appLocale: "en", limit: 10 })
    ).resolves.toEqual({ activeReleaseId: null, articles: [], managed: false });
    await expect(
      unmanaged.query(listing, {
        appLocale: "en",
        category: "politics",
        limit: 10,
      })
    ).resolves.toEqual({ activeReleaseId: null, articles: [], managed: false });
    await expect(
      unmanaged.query(bucket, { appLocale: "en", bucket: "abc" })
    ).resolves.toEqual({
      activeReleaseId: null,
      articles: null,
      managed: false,
    });

    const managed = convexTest(schema, convexModules);
    await managed.mutation((ctx) => insertRuntimeArticles(ctx, 1));
    await expect(
      managed.query(bucket, { appLocale: "en", bucket: "fff" })
    ).resolves.toMatchObject({
      activeReleaseId: expect.any(String),
      articles: null,
      managed: true,
    });
  });

  it("rejects invalid limits and partition identities", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query(latest, { appLocale: "en", limit: 101 })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(
      t.query(listing, {
        appLocale: "en",
        category: "politics",
        limit: 0,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(
      t.query(bucket, { appLocale: "en", bucket: "wrong" })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
