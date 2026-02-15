import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  /**
   * Content views for statistics tracking - articles only.
   * Separate table enables type-safe aggregate with simple ID key.
   */
  articleContentViews: defineTable({
    contentId: v.id("articleContents"),
    locale: localeValidator,
    slug: v.string(),
    deviceId: v.string(),
    userId: v.optional(v.id("users")),
    firstViewedAt: v.number(),
    lastViewedAt: v.number(), // For rate limiting
    viewCount: v.number(),
    totalDurationSeconds: v.number(),
  })
    .index("userId_contentId", ["userId", "contentId"])
    .index("deviceId_contentId", ["deviceId", "contentId"])
    .index("contentId_locale", ["contentId", "locale"]),

  /**
   * Content views for statistics tracking - subject sections only.
   * Separate table enables type-safe aggregate with simple ID key.
   */
  subjectContentViews: defineTable({
    contentId: v.id("subjectSections"),
    locale: localeValidator,
    slug: v.string(),
    deviceId: v.string(),
    userId: v.optional(v.id("users")),
    firstViewedAt: v.number(),
    lastViewedAt: v.number(), // For rate limiting
    viewCount: v.number(),
    totalDurationSeconds: v.number(),
  })
    .index("userId_contentId", ["userId", "contentId"])
    .index("deviceId_contentId", ["deviceId", "contentId"])
    .index("contentId_locale", ["contentId", "locale"]),

  /**
   * Content views for statistics tracking - exercises only.
   * Separate table for exercise tracking (not used for audio).
   */
  exerciseContentViews: defineTable({
    contentId: v.id("exerciseSets"),
    locale: localeValidator,
    slug: v.string(),
    deviceId: v.string(),
    userId: v.optional(v.id("users")),
    firstViewedAt: v.number(),
    lastViewedAt: v.number(), // For rate limiting
    viewCount: v.number(),
    totalDurationSeconds: v.number(),
  })
    .index("userId_contentId", ["userId", "contentId"])
    .index("deviceId_contentId", ["deviceId", "contentId"])
    .index("contentId_locale", ["contentId", "locale"]),
};

export default tables;
