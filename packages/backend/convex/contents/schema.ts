import {
  contentRefValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  /**
   * Unified content views table.
   * One record per user/device per content.
   * Tracks first and last view timestamps for engagement analytics.
   */
  contentViews: defineTable({
    contentRef: contentRefValidator,
    locale: localeValidator,
    slug: v.string(),
    deviceId: v.string(),
    userId: v.optional(v.id("users")),
    firstViewedAt: v.number(),
    lastViewedAt: v.number(),
  })
    .index("by_userId_and_contentRefId", ["userId", "contentRef.id"])
    .index("by_userId_and_contentRefType_and_locale_and_lastViewedAt", [
      "userId",
      "contentRef.type",
      "locale",
      "lastViewedAt",
    ])
    .index("by_deviceId_and_contentRefId", ["deviceId", "contentRef.id"])
    .index("by_locale_and_contentRefType_and_lastViewedAt", [
      "locale",
      "contentRef.type",
      "lastViewedAt",
    ]),

  /**
   * Append-only queue of new unique views.
   * A background mutation drains this queue into derived analytics tables.
   */
  contentViewAnalyticsQueue: defineTable({
    contentRef: contentRefValidator,
    locale: localeValidator,
    viewedAt: v.number(),
  }),

  /**
   * Article popularity counts.
   * Updated asynchronously from the content analytics queue.
   */
  articlePopularity: defineTable({
    contentId: v.id("articleContents"),
    viewCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_contentId", ["contentId"])
    .index("by_viewCount_and_contentId", ["viewCount", "contentId"]),

  /**
   * Subject popularity counts.
   * Updated asynchronously from the content analytics queue.
   */
  subjectPopularity: defineTable({
    contentId: v.id("subjectSections"),
    viewCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_contentId", ["contentId"])
    .index("by_viewCount_and_contentId", ["viewCount", "contentId"]),

  /**
   * Daily subject view counts used to serve bounded trending queries.
   * One row per locale, subject, and UTC day bucket.
   */
  subjectTrendingBuckets: defineTable({
    bucketStart: v.number(),
    contentId: v.id("subjectSections"),
    locale: localeValidator,
    updatedAt: v.number(),
    viewCount: v.number(),
  }).index("by_locale_and_bucketStart_and_contentId", [
    "locale",
    "bucketStart",
    "contentId",
  ]),

  /**
   * Exercise popularity counts.
   * Updated asynchronously from the content analytics queue.
   */
  exercisePopularity: defineTable({
    contentId: v.id("exerciseSets"),
    viewCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_contentId", ["contentId"])
    .index("by_viewCount_and_contentId", ["viewCount", "contentId"]),
};

export default tables;
