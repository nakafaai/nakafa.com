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
    .index("by_locale_type_lastViewedAt", [
      "locale",
      "contentRef.type",
      "lastViewedAt",
    ]),

  /**
   * Article popularity counts.
   * Updated via triggers when article views are recorded.
   */
  articlePopularity: defineTable({
    contentId: v.id("articleContents"),
    viewCount: v.number(),
    updatedAt: v.number(),
  }).index("by_contentId", ["contentId"]),

  /**
   * Subject popularity counts.
   * Updated via triggers when subject views are recorded.
   */
  subjectPopularity: defineTable({
    contentId: v.id("subjectSections"),
    viewCount: v.number(),
    updatedAt: v.number(),
  }).index("by_contentId", ["contentId"]),

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
  }).index("by_locale_bucketStart_contentId", [
    "locale",
    "bucketStart",
    "contentId",
  ]),

  /**
   * Exercise popularity counts.
   * Updated via triggers when exercise views are recorded.
   */
  exercisePopularity: defineTable({
    contentId: v.id("exerciseSets"),
    viewCount: v.number(),
    updatedAt: v.number(),
  }).index("by_contentId", ["contentId"]),
};

export default tables;
