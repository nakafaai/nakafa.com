import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertRuntimeArticles } from "@repo/backend/test/content-runtime";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const bucket = api.contentRelease.article.bucket;
const latest = api.contentRelease.article.latest;
const listing = api.contentRelease.article.listing;

describe("contentRelease/article/discovery", () => {
  it("returns newest articles and one exact managed partition", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertRuntimeArticles(ctx, 2));
    const catalog = await t.run((ctx) =>
      ctx.db
        .query("articleCatalog")
        .withIndex("by_locale_and_date_and_contentKey", (index) =>
          index.eq("locale", "en")
        )
        .order("desc")
        .take(2)
    );
    const selected = catalog[0];
    if (!selected) {
      throw new Error("Expected one article catalog row.");
    }

    await expect(
      t.query(latest, { limit: 1, locale: "en" })
    ).resolves.toMatchObject({
      articles: [
        {
          articleSlug: "article-1",
          authors: [{ name: "Nakafa" }],
          category: "politics",
          date: "2026-07-11",
          publicPath: "articles/politics/article-1",
          title: "Article 1",
        },
      ],
      managed: true,
    });
    await expect(
      t.query(listing, {
        category: "politics",
        limit: 1,
        locale: "en",
      })
    ).resolves.toMatchObject({
      articles: [
        {
          articleSlug: "article-1",
          category: "politics",
          publicPath: "articles/politics/article-1",
        },
      ],
      managed: true,
    });
    await expect(
      t.query(bucket, { bucket: selected.bucket, locale: "en" })
    ).resolves.toMatchObject({
      articles: expect.arrayContaining([
        expect.objectContaining({ publicPath: selected.publicPath }),
      ]),
      managed: true,
    });
  });

  it("distinguishes unmanaged and absent managed partitions", async () => {
    const unmanaged = convexTest(schema, convexModules);
    await expect(
      unmanaged.query(latest, { limit: 10, locale: "en" })
    ).resolves.toEqual({ articles: [], managed: false });
    await expect(
      unmanaged.query(listing, {
        category: "politics",
        limit: 10,
        locale: "en",
      })
    ).resolves.toEqual({ articles: [], managed: false });
    await expect(
      unmanaged.query(bucket, { bucket: "abc", locale: "en" })
    ).resolves.toEqual({ articles: null, managed: false });

    const managed = convexTest(schema, convexModules);
    await managed.mutation((ctx) => insertRuntimeArticles(ctx, 1));
    await expect(
      managed.query(bucket, { bucket: "fff", locale: "en" })
    ).resolves.toEqual({ articles: null, managed: true });
  });

  it("rejects invalid limits and partition identities", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query(latest, { limit: 101, locale: "en" })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(
      t.query(listing, {
        category: "politics",
        limit: 0,
        locale: "en",
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(
      t.query(bucket, { bucket: "wrong", locale: "en" })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
