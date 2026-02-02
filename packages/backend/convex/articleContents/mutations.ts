import { internalMutation } from "@repo/backend/convex/functions";
import {
  articleCategoryValidator,
  contentTypeValidator,
  localeValidator,
} from "@repo/backend/convex/lib/contentValidators";
import { v } from "convex/values";

/**
 * Upsert an article content document.
 * Creates if not exists, updates if contentHash changed.
 * Returns: { id, action: "created" | "updated" | "unchanged" }
 */
export const upsertArticleContent = internalMutation({
  args: {
    locale: localeValidator,
    slug: v.string(),
    category: articleCategoryValidator,
    articleSlug: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    date: v.number(),
    body: v.string(),
    contentHash: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("articleContents")
      .withIndex("locale_slug", (q) =>
        q.eq("locale", args.locale).eq("slug", args.slug)
      )
      .first();

    if (existing) {
      if (existing.contentHash === args.contentHash) {
        return { id: existing._id, action: "unchanged" as const };
      }

      await ctx.db.patch(existing._id, {
        category: args.category,
        articleSlug: args.articleSlug,
        title: args.title,
        description: args.description,
        date: args.date,
        body: args.body,
        contentHash: args.contentHash,
        syncedAt: now,
      });

      return { id: existing._id, action: "updated" as const };
    }

    const id = await ctx.db.insert("articleContents", {
      locale: args.locale,
      slug: args.slug,
      category: args.category,
      articleSlug: args.articleSlug,
      title: args.title,
      description: args.description,
      date: args.date,
      body: args.body,
      contentHash: args.contentHash,
      syncedAt: now,
    });

    return { id, action: "created" as const };
  },
});

/**
 * Sync article references for a given article.
 * Deletes existing references and inserts new ones.
 */
export const syncArticleReferences = internalMutation({
  args: {
    articleId: v.id("articleContents"),
    references: v.array(
      v.object({
        title: v.string(),
        authors: v.string(),
        year: v.number(),
        url: v.optional(v.string()),
        citation: v.optional(v.string()),
        publication: v.optional(v.string()),
        details: v.optional(v.string()),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("articleReferences")
      .withIndex("articleId", (q) => q.eq("articleId", args.articleId))
      .collect();

    for (const ref of existing) {
      await ctx.db.delete(ref._id);
    }

    for (const ref of args.references) {
      await ctx.db.insert("articleReferences", {
        articleId: args.articleId,
        title: ref.title,
        authors: ref.authors,
        year: ref.year,
        url: ref.url,
        citation: ref.citation,
        publication: ref.publication,
        details: ref.details,
        order: ref.order,
      });
    }

    return { count: args.references.length };
  },
});

/**
 * Link author to content via contentAuthors join table.
 * Upserts author by name if not exists.
 * Generates username from name (slugified) when creating new author.
 */
export const linkContentAuthor = internalMutation({
  args: {
    contentId: v.string(),
    contentType: contentTypeValidator,
    authorName: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    let author = await ctx.db
      .query("authors")
      .withIndex("name", (q) => q.eq("name", args.authorName))
      .first();

    if (!author) {
      const username = slugifyName(args.authorName);
      const authorId = await ctx.db.insert("authors", {
        name: args.authorName,
        username,
      });
      author = await ctx.db.get(authorId);
    }

    if (!author) {
      throw new Error(`Failed to create author: ${args.authorName}`);
    }

    const existing = await ctx.db
      .query("contentAuthors")
      .withIndex("contentId_contentType", (q) =>
        q.eq("contentId", args.contentId).eq("contentType", args.contentType)
      )
      .filter((q) => q.eq(q.field("authorId"), author._id))
      .first();

    if (existing) {
      if (existing.order !== args.order) {
        await ctx.db.patch(existing._id, { order: args.order });
      }
      return {
        authorId: author._id,
        linkId: existing._id,
        action: "updated" as const,
      };
    }

    const linkId = await ctx.db.insert("contentAuthors", {
      contentId: args.contentId,
      contentType: args.contentType,
      authorId: author._id,
      order: args.order,
    });

    return { authorId: author._id, linkId, action: "created" as const };
  },
});

/**
 * Generate a URL-safe username from a display name.
 * "John Doe" -> "john-doe"
 */
function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Remove all content authors for a given content item.
 * Called before re-linking to handle author changes.
 */
export const clearContentAuthors = internalMutation({
  args: {
    contentId: v.string(),
    contentType: contentTypeValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contentAuthors")
      .withIndex("contentId_contentType", (q) =>
        q.eq("contentId", args.contentId).eq("contentType", args.contentType)
      )
      .collect();

    for (const link of existing) {
      await ctx.db.delete(link._id);
    }

    return { deleted: existing.length };
  },
});
