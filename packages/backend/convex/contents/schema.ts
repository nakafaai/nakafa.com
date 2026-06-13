import { CONTENT_ROUTE_KINDS } from "@repo/backend/convex/contents/constants";
import {
  graphContentIdValidator,
  learningGraphIdentityValidator,
} from "@repo/backend/convex/contents/graph";
import { contentSearchDocumentValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import {
  localeValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const contentRouteKindValidator = literals(...CONTENT_ROUTE_KINDS);
const contentRoutePageItemValidator = v.object({
  ...learningGraphIdentityValidator.fields,
  authors: v.array(v.object({ name: v.string() })),
  content_id: v.string(),
  date: v.optional(v.number()),
  depth: v.optional(v.number()),
  description: v.optional(v.string()),
  kind: contentRouteKindValidator,
  locale: localeValidator,
  markdown: v.boolean(),
  official: v.optional(v.boolean()),
  parentRoute: v.optional(v.string()),
  route: v.string(),
  section: nakafaSectionValidator,
  syncedAt: v.number(),
  title: v.string(),
});

const tables = {
  /**
   * Unified content views table.
   * One record per user/device per content.
   * Tracks first and last view timestamps for engagement analytics.
   */
  contentViews: defineTable({
    ...learningGraphIdentityValidator.fields,
    content_id: graphContentIdValidator,
    deviceId: v.string(),
    firstViewedAt: v.number(),
    lastViewedAt: v.number(),
    locale: localeValidator,
    route: v.string(),
    section: nakafaSectionValidator,
    userId: v.optional(v.id("users")),
  })
    .index("by_userId_and_content_id", ["userId", "content_id"])
    .index("by_userId_and_section_and_locale_and_lastViewedAt", [
      "userId",
      "section",
      "locale",
      "lastViewedAt",
    ])
    .index("by_deviceId_and_content_id", ["deviceId", "content_id"])
    .index("by_locale_and_section_and_lastViewedAt", [
      "locale",
      "section",
      "lastViewedAt",
    ]),

  /**
   * Append-only queue of new unique views.
   * Queue rows are partitioned so background processors can drain them in parallel.
   */
  contentViewAnalyticsQueue: defineTable({
    ...learningGraphIdentityValidator.fields,
    content_id: graphContentIdValidator,
    locale: localeValidator,
    partition: v.number(),
    route: v.string(),
    section: nakafaSectionValidator,
    viewedAt: v.number(),
  }).index("by_partition", ["partition"]),

  /**
   * Lease rows for partitioned analytics queue processing.
   * One row per partition.
   */
  contentAnalyticsPartitions: defineTable({
    leaseExpiresAt: v.number(),
    leaseVersion: v.number(),
    lastProcessedAt: v.optional(v.number()),
    partition: v.number(),
  }).index("by_partition", ["partition"]),

  /**
   * Article popularity counts.
   * Updated asynchronously from the content analytics queue.
   */
  articlePopularity: defineTable({
    ...learningGraphIdentityValidator.fields,
    content_id: graphContentIdValidator,
    viewCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_content_id", ["content_id"])
    .index("by_viewCount_and_content_id", ["viewCount", "content_id"]),

  /**
   * Subject popularity counts.
   * Updated asynchronously from the content analytics queue.
   */
  subjectPopularity: defineTable({
    ...learningGraphIdentityValidator.fields,
    content_id: graphContentIdValidator,
    viewCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_content_id", ["content_id"])
    .index("by_viewCount_and_content_id", ["viewCount", "content_id"]),

  /**
   * Daily subject view counts used to serve bounded trending queries.
   * One row per locale, subject, and UTC day bucket.
   */
  subjectTrendingBuckets: defineTable({
    bucketStart: v.number(),
    ...learningGraphIdentityValidator.fields,
    content_id: graphContentIdValidator,
    locale: localeValidator,
    updatedAt: v.number(),
    viewCount: v.number(),
  }).index("by_locale_and_bucketStart_and_content_id", [
    "locale",
    "bucketStart",
    "content_id",
  ]),

  /**
   * Exercise popularity counts.
   * Updated asynchronously from the content analytics queue.
   */
  exercisePopularity: defineTable({
    ...learningGraphIdentityValidator.fields,
    content_id: graphContentIdValidator,
    viewCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_content_id", ["content_id"])
    .index("by_viewCount_and_content_id", ["viewCount", "content_id"]),

  /**
   * Derived content search read model for Nina and MCP.
   * Rebuilt from synced articles, subject sections, exercise questions, and Quran.
   */
  contentSearch: defineTable(contentSearchDocumentValidator)
    .index("by_content_id", ["content_id"])
    .index("by_locale_and_route", ["locale", "route"])
    .index("by_locale_and_title", ["locale", "title"])
    .index("by_locale_and_section_and_title", ["locale", "section", "title"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["locale", "section"],
    })
    .searchIndex("search_text", {
      searchField: "text",
      filterFields: ["locale", "section"],
    })
    .searchIndex("search_route", {
      searchField: "route",
      filterFields: ["locale", "section"],
    }),

  /** Concrete public routes synced from the durable content runtime model. */
  contentRoutes: defineTable({
    ...learningGraphIdentityValidator.fields,
    authors: v.array(v.object({ name: v.string() })),
    countedAt: v.optional(v.number()),
    contentHash: v.string(),
    content_id: v.string(),
    date: v.optional(v.number()),
    depth: v.optional(v.number()),
    description: v.optional(v.string()),
    kind: contentRouteKindValidator,
    locale: localeValidator,
    markdown: v.boolean(),
    official: v.optional(v.boolean()),
    parentRoute: v.optional(v.string()),
    route: v.string(),
    section: nakafaSectionValidator,
    syncedAt: v.number(),
    title: v.string(),
  })
    .index("by_content_id", ["content_id"])
    .index("by_locale", ["locale"])
    .index("by_locale_and_route", ["locale", "route"])
    .index("by_locale_and_kind", ["locale", "kind"])
    .index("by_locale_and_section", ["locale", "section"])
    .index("by_locale_and_section_and_date", ["locale", "section", "date"])
    .index("by_locale_and_section_and_route", ["locale", "section", "route"])
    .index("by_locale_and_section_and_kind_and_route", [
      "locale",
      "section",
      "kind",
      "route",
    ])
    .index("by_locale_and_section_and_kind_and_parentRoute_and_route", [
      "locale",
      "section",
      "kind",
      "parentRoute",
      "route",
    ])
    .index("by_locale_and_section_and_kind_and_parentRoute_and_date", [
      "locale",
      "section",
      "kind",
      "parentRoute",
      "date",
    ])
    .index("by_kind", ["kind"])
    .index("by_section", ["section"]),

  /** Bounded route pages materialized by sync for sitemap and LLMS artifacts. */
  contentRoutePages: defineTable({
    locale: localeValidator,
    page: v.number(),
    routeCount: v.number(),
    routes: v.array(contentRoutePageItemValidator),
    section: nakafaSectionValidator,
    syncedAt: v.number(),
  })
    .index("by_locale_and_section", ["locale", "section"])
    .index("by_locale_and_section_and_page", ["locale", "section", "page"]),

  /** Materialized route counts used by agent taxonomy without route scans. */
  contentRouteCounts: defineTable({
    count: v.number(),
    locale: localeValidator,
    section: nakafaSectionValidator,
    syncedAt: v.number(),
  })
    .index("by_locale", ["locale"])
    .index("by_locale_and_section", ["locale", "section"]),
};

export default tables;
