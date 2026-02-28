import { contentRefValidator } from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  /**
   * Unified content views table.
   * One record per user/device per content.
   */
  contentViews: defineTable({
    contentRef: contentRefValidator,
    locale: v.string(),
    slug: v.string(),
    deviceId: v.string(),
    userId: v.optional(v.id("users")),
    viewedAt: v.number(),
  })
    .index("userId_contentRefId", ["userId", "contentRef.id"])
    .index("deviceId_contentRefId", ["deviceId", "contentRef.id"])
    .index("contentRefId_locale", ["contentRef.id", "locale"])
    .index("by_locale_type_viewedAt", [
      "locale",
      "contentRef.type",
      "viewedAt",
    ]),

  /**
   * Article popularity counts.
   * Updated via triggers when article views are recorded.
   */
  articlePopularity: defineTable({
    contentId: v.id("articleContents"),
    viewCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_popularity", ["viewCount"])
    .index("by_contentId", ["contentId"]),

  /**
   * Subject popularity counts.
   * Updated via triggers when subject views are recorded.
   */
  subjectPopularity: defineTable({
    contentId: v.id("subjectSections"),
    viewCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_popularity", ["viewCount"])
    .index("by_contentId", ["contentId"]),

  /**
   * Exercise popularity counts.
   * Updated via triggers when exercise views are recorded.
   */
  exercisePopularity: defineTable({
    contentId: v.id("exerciseSets"),
    viewCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_popularity", ["viewCount"])
    .index("by_contentId", ["contentId"]),
};

export default tables;
