import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  /**
   * Unique content views - one record per user/device per content.
   * View count = number of records (no viewCount field needed).
   */
  articleContentViews: defineTable({
    contentId: v.id("articleContents"),
    locale: localeValidator,
    slug: v.string(),
    deviceId: v.string(),
    userId: v.optional(v.id("users")),
    firstViewedAt: v.number(),
    lastViewedAt: v.number(),
    // Note: No viewCount field - each record represents exactly 1 view
  })
    .index("userId_contentId", ["userId", "contentId"])
    .index("deviceId_contentId", ["deviceId", "contentId"])
    .index("contentId_locale", ["contentId", "locale"]),

  subjectContentViews: defineTable({
    contentId: v.id("subjectSections"),
    locale: localeValidator,
    slug: v.string(),
    deviceId: v.string(),
    userId: v.optional(v.id("users")),
    firstViewedAt: v.number(),
    lastViewedAt: v.number(),
  })
    .index("userId_contentId", ["userId", "contentId"])
    .index("deviceId_contentId", ["deviceId", "contentId"])
    .index("contentId_locale", ["contentId", "locale"]),

  exerciseContentViews: defineTable({
    contentId: v.id("exerciseSets"),
    locale: localeValidator,
    slug: v.string(),
    deviceId: v.string(),
    userId: v.optional(v.id("users")),
    firstViewedAt: v.number(),
    lastViewedAt: v.number(),
  })
    .index("userId_contentId", ["userId", "contentId"])
    .index("deviceId_contentId", ["deviceId", "contentId"])
    .index("contentId_locale", ["contentId", "locale"]),
};

export default tables;
