import {
  articleCategoryValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  /**
   * Article content storage.
   * Authors are linked via contentAuthors join table.
   */
  articleContents: defineTable({
    locale: localeValidator,
    /** Full URL path: "articles/politics/nepotism-in-governance" */
    slug: v.string(),
    category: articleCategoryValidator,
    /** Article identifier only: "nepotism-in-governance" */
    articleSlug: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    /** Publication date as epoch milliseconds */
    date: v.number(),
    /** MDX content (metadata export stripped) */
    body: v.string(),
    /** SHA-256 hash of body for sync change detection */
    contentHash: v.string(),
    /** Last sync timestamp (epoch ms) */
    syncedAt: v.number(),
  })
    .index("locale_slug", ["locale", "slug"])
    .index("locale_category", ["locale", "category"])
    .index("contentHash", ["contentHash"]),

  /**
   * Normalized article citations.
   * Separate table because articles can have 50+ references (exceeds Convex's 5-10 array limit).
   */
  articleReferences: defineTable({
    articleId: v.id("articleContents"),
    title: v.string(),
    /** Author names as formatted string */
    authors: v.string(),
    year: v.number(),
    url: v.optional(v.string()),
    /** Citation key for disambiguation, e.g. "2024a", "2024b" */
    citation: v.optional(v.string()),
    publication: v.optional(v.string()),
    details: v.optional(v.string()),
    /** Position in reference list */
    order: v.number(),
  }).index("articleId", ["articleId"]),
};

export default tables;
