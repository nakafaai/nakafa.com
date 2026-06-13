import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

interface SyncedArticle {
  articleSlug: string;
  authors: Array<{ name: string }>;
  body: string;
  category: Doc<"articleContents">["category"];
  contentHash: string;
  date: number;
  description?: string;
  locale: Doc<"articleContents">["locale"];
  official: boolean;
  references: SyncedArticleReference[];
  slug: string;
  title: string;
}

interface SyncedArticleReference {
  authors: string;
  citation?: string;
  details?: string;
  publication?: string;
  title: string;
  url?: string;
  year: number;
}

const ARTICLE_SLUG = "articles/politics/metadata-only";
const ARTICLE_CONTENT_ID = getGraphContentId(ARTICLE_SLUG);
const BASE_REFERENCE: SyncedArticleReference = {
  authors: "Ada",
  citation: "ada-2026",
  details: "pp. 1-2",
  publication: "Nakafa Journal",
  title: "Old Reference",
  url: "https://nakafa.com/reference",
  year: 2026,
};
const BASE_ARTICLE: SyncedArticle = {
  articleSlug: "metadata-only",
  authors: [{ name: "Ada" }],
  body: "Article body",
  category: "politics",
  contentHash: "same-article-hash",
  date: 1,
  description: "Old article description",
  locale: "id",
  official: true,
  references: [BASE_REFERENCE],
  slug: ARTICLE_SLUG,
  title: "Old Article Title",
};

/** Builds a complete article sync payload with focused field overrides. */
function buildArticle(overrides: Partial<SyncedArticle> = {}): SyncedArticle {
  return { ...BASE_ARTICLE, ...overrides };
}

/** Returns the graph asset ID for an article route fixture. */
function getGraphContentId(route: string) {
  const identity = createLearningGraphIdentityFromRoute({
    locale: "id",
    route,
  });

  if (!identity) {
    throw new Error(`Expected graph identity for ${route}.`);
  }

  return identity.assetId;
}

describe("contentSync/mutations/articles", () => {
  it("syncs article rows, references, authors, search, and audio metadata", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("authors", { name: "Ada", username: "ada" });
      await ctx.db.insert("authors", { name: "Budi", username: "budi" });
    });

    const created = await t.mutation(
      internal.contentSync.mutations.articles.bulkSyncArticles,
      { articles: [buildArticle()] }
    );
    const unchanged = await t.mutation(
      internal.contentSync.mutations.articles.bulkSyncArticles,
      { articles: [buildArticle()] }
    );
    const metadataUpdated = await t.mutation(
      internal.contentSync.mutations.articles.bulkSyncArticles,
      {
        articles: [
          buildArticle({
            date: 2,
            description: "New article description",
            title: "New Article Title",
          }),
        ],
      }
    );
    const contentUpdated = await t.mutation(
      internal.contentSync.mutations.articles.bulkSyncArticles,
      {
        articles: [
          buildArticle({
            authors: [{ name: "Budi" }],
            body: "Updated article body",
            contentHash: "updated-article-hash",
            date: 2,
            description: "New article description",
            references: [
              {
                authors: "Budi",
                title: "New Reference",
                year: 2027,
              },
            ],
            title: "New Article Title",
          }),
        ],
      }
    );

    const snapshot = await t.query(async (ctx) => {
      const article = await ctx.db
        .query("articleContents")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", ARTICLE_SLUG)
        )
        .unique();

      if (!article) {
        throw new Error("Expected synced article.");
      }

      const references = await ctx.db
        .query("articleReferences")
        .withIndex("by_articleId", (q) => q.eq("articleId", article._id))
        .collect();
      const authorLinks = await ctx.db
        .query("contentAuthors")
        .withIndex("by_contentId_and_contentType_and_authorId", (q) =>
          q.eq("contentId", article._id).eq("contentType", "article")
        )
        .collect();
      const search = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", ARTICLE_CONTENT_ID)
        )
        .unique();
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", ARTICLE_CONTENT_ID)
        )
        .unique();
      const audioSource = await ctx.db
        .query("audioContentSources")
        .withIndex("by_contentRefType_and_slug_and_locale", (q) =>
          q
            .eq("contentRef.type", "article")
            .eq("slug", ARTICLE_SLUG)
            .eq("locale", "id")
        )
        .unique();

      return { article, audioSource, authorLinks, references, route, search };
    });

    expect(created).toEqual({
      authorLinksCreated: 1,
      created: 1,
      referencesCreated: 1,
      unchanged: 0,
      updated: 0,
    });
    expect(unchanged).toEqual({
      authorLinksCreated: 0,
      created: 0,
      referencesCreated: 0,
      unchanged: 1,
      updated: 0,
    });
    expect(metadataUpdated.updated).toBe(1);
    expect(contentUpdated).toMatchObject({
      authorLinksCreated: 1,
      referencesCreated: 1,
      updated: 1,
    });
    expect(snapshot.article).toMatchObject({
      body: "Updated article body",
      date: 2,
      description: "New article description",
      title: "New Article Title",
    });
    expect(snapshot.references).toHaveLength(1);
    expect(snapshot.references[0]).toMatchObject({ title: "New Reference" });
    expect(snapshot.authorLinks).toHaveLength(1);
    expect(snapshot.search).toMatchObject({
      contentHash: "updated-article-hash",
      route: ARTICLE_SLUG,
      title: "New Article Title",
    });
    expect(snapshot.route).toMatchObject({
      contentHash: "updated-article-hash",
      kind: "article",
      official: true,
      route: ARTICLE_SLUG,
      title: "New Article Title",
    });
    expect(snapshot.audioSource).toMatchObject({
      contentHash: "updated-article-hash",
      slug: ARTICLE_SLUG,
    });
  });

  it("returns empty summaries for empty article sync and stale delete batches", async () => {
    const t = convexTest(schema, convexModules);

    const syncResult = await t.mutation(
      internal.contentSync.mutations.articles.bulkSyncArticles,
      { articles: [] }
    );
    const deleteResult = await t.mutation(
      internal.contentSync.mutations.articles.deleteStaleArticles,
      { articleIds: [] }
    );

    expect(syncResult).toEqual({
      authorLinksCreated: 0,
      created: 0,
      referencesCreated: 0,
      unchanged: 0,
      updated: 0,
    });
    expect(deleteResult).toEqual({ deleted: 0 });
  });

  it("deletes stale articles and skips IDs that already disappeared", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("authors", { name: "Ada", username: "ada" });
    });
    await t.mutation(internal.contentSync.mutations.articles.bulkSyncArticles, {
      articles: [buildArticle()],
    });
    const ids = await t.mutation(async (ctx) => {
      const article = await ctx.db
        .query("articleContents")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", ARTICLE_SLUG)
        )
        .unique();
      const missingId = await ctx.db.insert("articleContents", {
        articleSlug: "missing",
        body: "Missing body",
        category: "politics",
        contentHash: "missing-hash",
        date: 1,
        locale: "id",
        slug: "articles/politics/missing",
        syncedAt: 1,
        title: "Missing",
      });

      if (!article) {
        throw new Error("Expected synced article before stale delete.");
      }

      await ctx.db.delete("articleContents", missingId);

      return { articleId: article._id, missingId };
    });

    const result = await t.mutation(
      internal.contentSync.mutations.articles.deleteStaleArticles,
      { articleIds: [ids.articleId, ids.missingId] }
    );
    const snapshot = await t.query(async (ctx) => {
      const article = await ctx.db.get(ids.articleId);
      const references = await ctx.db
        .query("articleReferences")
        .withIndex("by_articleId", (q) => q.eq("articleId", ids.articleId))
        .collect();
      const authorLinks = await ctx.db
        .query("contentAuthors")
        .withIndex("by_contentId_and_contentType_and_authorId", (q) =>
          q.eq("contentId", ids.articleId).eq("contentType", "article")
        )
        .collect();
      const search = await ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", ARTICLE_CONTENT_ID)
        )
        .unique();
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", ARTICLE_CONTENT_ID)
        )
        .unique();
      const audioSource = await ctx.db
        .query("audioContentSources")
        .withIndex("by_contentRefType_and_slug_and_locale", (q) =>
          q
            .eq("contentRef.type", "article")
            .eq("slug", ARTICLE_SLUG)
            .eq("locale", "id")
        )
        .unique();

      return { article, audioSource, authorLinks, references, route, search };
    });

    expect(result).toEqual({ deleted: 1 });
    expect(snapshot).toEqual({
      article: null,
      audioSource: null,
      authorLinks: [],
      references: [],
      route: null,
      search: null,
    });
  });
});
