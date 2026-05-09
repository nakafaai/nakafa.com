import { api, internal } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "vitest";

describe("contents/queries/search:search", () => {
  it("searches title and body text with locale and section filters", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-rational",
        content_id:
          "id/subject/high-school/11/mathematics/function-modeling/rational-function",
        description: "Pelajari fungsi rasional.",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/rational-function.md",
        route:
          "subject/high-school/11/mathematics/function-modeling/rational-function",
        section: "subject",
        syncedAt: 1,
        text: "kelas 11 matematika pemodelan fungsi penyebut domain asimtot",
        title: "Fungsi Rasional",
        url: "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/rational-function",
      });
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-domain",
        content_id:
          "id/subject/high-school/11/mathematics/function-modeling/domain-codomain-range",
        description: "Pelajari domain dan range.",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/domain-codomain-range.md",
        route:
          "subject/high-school/11/mathematics/function-modeling/domain-codomain-range",
        section: "subject",
        syncedAt: 1,
        text: "fungsi rasional muncul dalam contoh batas input dan output",
        title: "Domain, Kodomain, dan Range",
        url: "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/domain-codomain-range",
      });
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-en",
        content_id:
          "en/subject/high-school/11/mathematics/function-modeling/rational-function",
        description: "Learn rational functions.",
        locale: "en",
        markdown_url:
          "https://nakafa.com/en/subject/high-school/11/mathematics/function-modeling/rational-function.md",
        route:
          "subject/high-school/11/mathematics/function-modeling/rational-function",
        section: "subject",
        syncedAt: 1,
        text: "grade 11 mathematics rational function",
        title: "Rational Function",
        url: "https://nakafa.com/en/subject/high-school/11/mathematics/function-modeling/rational-function",
      });
    });

    const titleResult = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      query: "fungsi rasional kelas 11",
      section: "subject",
    });
    const bodyResult = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      query: "batas input output",
      section: "subject",
    });

    expect(titleResult.items.map((item) => item.title)).toEqual([
      "Fungsi Rasional",
      "Domain, Kodomain, dan Range",
    ]);
    expect(bodyResult.items).toEqual([
      expect.objectContaining({
        content_id:
          "id/subject/high-school/11/mathematics/function-modeling/domain-codomain-range",
      }),
    ]);
  });

  it("browses a stable bounded list when no query is provided", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-b",
        content_id: "id/articles/science/b",
        description: "",
        locale: "id",
        markdown_url: "https://nakafa.com/id/articles/science/b.md",
        route: "articles/science/b",
        section: "articles",
        syncedAt: 1,
        text: "Beta",
        title: "Beta",
        url: "https://nakafa.com/id/articles/science/b",
      });
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-a",
        content_id: "id/articles/science/a",
        description: "",
        locale: "id",
        markdown_url: "https://nakafa.com/id/articles/science/a.md",
        route: "articles/science/a",
        section: "articles",
        syncedAt: 1,
        text: "Alpha",
        title: "Alpha",
        url: "https://nakafa.com/id/articles/science/a",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 1,
      locale: "id",
      offset: 0,
      section: "articles",
    });

    expect(result).toMatchObject({
      count: 1,
      has_more: true,
      next_offset: 1,
    });
    expect(result.items[0].title).toBe("Alpha");
  });

  it("removes article search rows when stale synced content is deleted", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(internal.contentSync.mutations.articles.bulkSyncArticles, {
      articles: [
        {
          articleSlug: "valid-article",
          authors: [],
          body: "body about searchable deletion",
          category: "politics",
          contentHash: "hash-valid",
          date: 1,
          description: "Searchable article",
          locale: "id",
          references: [],
          slug: "articles/science/valid-article",
          title: "Valid Article",
        },
      ],
    });

    const articleId = await t.query(async (ctx) => {
      const article = await ctx.db
        .query("articleContents")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", "articles/science/valid-article")
        )
        .unique();

      if (!article) {
        throw new Error("Expected synced article.");
      }

      return article._id;
    });

    await t.mutation(
      internal.contentSync.mutations.articles.deleteStaleArticles,
      {
        articleIds: [articleId],
      }
    );

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      query: "searchable deletion",
    });

    expect(result.items).toEqual([]);
  });

  it("returns Quran rows written by the Quran search sync mutation", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(internal.contents.mutations.search.bulkSyncQuranSearch, {
      documents: [
        {
          contentHash: "hash-fatihah",
          description: "Pembukaan",
          locale: "id",
          route: "quran/1",
          text: "Al-Fatihah pembukaan rahmat petunjuk",
          title: "1. Al-Fatihah",
        },
      ],
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      query: "petunjuk",
      section: "quran",
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        content_id: "id/quran/1",
        section: "quran",
        title: "1. Al-Fatihah",
      }),
    ]);
  });
});
