import { CONTENT_ROUTE_KINDS } from "@repo/backend/convex/contents/constants";
import {
  graphContentIdValidator,
  learningGraphIdentityValidator,
} from "@repo/backend/convex/contents/graph";
import { contentSearchDocumentValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import {
  localeValidator,
  materialValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { PUBLIC_ROUTE_KIND_VALUES } from "@repo/contents/_types/route/schema";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const contentRouteKindValidator = literals(...CONTENT_ROUTE_KINDS);
const publicRouteKindValidator = literals(...PUBLIC_ROUTE_KIND_VALUES);
const contentRoutePageItemValidator = v.object({
  ...learningGraphIdentityValidator.fields,
  authors: v.array(v.object({ name: v.string() })),
  content_id: graphContentIdValidator,
  date: v.optional(v.number()),
  depth: v.optional(v.number()),
  description: v.optional(v.string()),
  kind: contentRouteKindValidator,
  locale: localeValidator,
  markdown: v.boolean(),
  materialDomain: v.optional(materialValidator),
  official: v.optional(v.boolean()),
  parentRoute: v.optional(v.string()),
  route: v.string(),
  section: nakafaSectionValidator,
  sourceParentPath: v.optional(v.string()),
  sourcePath: v.string(),
  syncedAt: v.number(),
  title: v.string(),
});

const tables = {
  /**
   * Graph-backed content view read model.
   * One record per user/device per content.
   * Tracks first and last view timestamps for engagement analytics.
   * `route` is a display/navigation projection; `content_id` is the graph asset ID.
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
   * Rows carry graph identity so analytics never resolves product identity from routes.
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
   * Daily graph-backed learning trend buckets.
   * One row per section, locale, graph asset ID, and UTC day bucket.
   */
  learningTrendingBuckets: defineTable({
    bucketStart: v.number(),
    ...learningGraphIdentityValidator.fields,
    content_id: graphContentIdValidator,
    locale: localeValidator,
    section: nakafaSectionValidator,
    updatedAt: v.number(),
    viewCount: v.number(),
  }).index("by_section_and_locale_and_bucketStart_and_content_id", [
    "section",
    "locale",
    "bucketStart",
    "content_id",
  ]),

  /**
   * Graph-backed learning popularity read model.
   * One row per graph asset ID; `section` and `locale` are query dimensions.
   */
  learningPopularity: defineTable({
    ...learningGraphIdentityValidator.fields,
    content_id: graphContentIdValidator,
    locale: localeValidator,
    section: nakafaSectionValidator,
    viewCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_content_id", ["content_id"])
    .index("by_section_and_viewCount_and_content_id", [
      "section",
      "viewCount",
      "content_id",
    ])
    .index("by_section_and_locale_and_viewCount_and_content_id", [
      "section",
      "locale",
      "viewCount",
      "content_id",
    ]),

  /**
   * Graph-backed content search read model for Nina and MCP.
   * Rebuilt from synced source tables; public results expose graph asset IDs.
   */
  contentSearch: defineTable(contentSearchDocumentValidator)
    .index("by_content_id", ["content_id"])
    .index("by_locale_and_route", ["locale", "route"])
    .index("by_locale_and_sourcePath", ["locale", "sourcePath"])
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

  /**
   * Graph-backed public route projection read model.
   * `route` is navigation metadata; `content_id` is the graph asset ID.
   */
  contentRoutes: defineTable({
    ...learningGraphIdentityValidator.fields,
    authors: v.array(v.object({ name: v.string() })),
    countedAt: v.optional(v.number()),
    contentHash: v.string(),
    content_id: graphContentIdValidator,
    date: v.optional(v.number()),
    depth: v.optional(v.number()),
    description: v.optional(v.string()),
    kind: contentRouteKindValidator,
    locale: localeValidator,
    markdown: v.boolean(),
    materialDomain: v.optional(materialValidator),
    official: v.optional(v.boolean()),
    parentRoute: v.optional(v.string()),
    route: v.string(),
    section: nakafaSectionValidator,
    sourceParentPath: v.optional(v.string()),
    sourcePath: v.string(),
    syncedAt: v.number(),
    title: v.string(),
  })
    .index("by_content_id", ["content_id"])
    .index("by_locale", ["locale"])
    .index("by_locale_and_route", ["locale", "route"])
    .index("by_locale_and_sourcePath", ["locale", "sourcePath"])
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

  /**
   * Source-owned public route projection for every material, curriculum,
   * assessment, and practice surface.
   *
   * These rows are not graph content bodies. They are the durable route
   * contract used by app routing, SEO artifacts, assistant context, and
   * curriculum/assessment navigation.
   */
  publicRoutes: defineTable({
    canonicalPath: v.optional(v.string()),
    description: v.optional(v.string()),
    kind: publicRouteKindValidator,
    locale: localeValidator,
    materialDomain: v.optional(materialValidator),
    materialKey: v.optional(v.string()),
    nodeKey: v.optional(v.string()),
    parentPath: v.optional(v.string()),
    programKey: v.optional(v.string()),
    publicPath: v.string(),
    sectionKey: v.optional(v.string()),
    sitemap: v.boolean(),
    sourcePath: v.optional(v.string()),
    syncedAt: v.number(),
    title: v.string(),
  })
    .index("by_locale_and_publicPath", ["locale", "publicPath"])
    .index("by_locale_and_kind_and_publicPath", [
      "locale",
      "kind",
      "publicPath",
    ])
    .index("by_locale_and_kind_and_parentPath_and_publicPath", [
      "locale",
      "kind",
      "parentPath",
      "publicPath",
    ])
    .index("by_programKey_and_locale_and_publicPath", [
      "programKey",
      "locale",
      "publicPath",
    ])
    .index("by_programKey_and_locale_and_parentPath_and_publicPath", [
      "programKey",
      "locale",
      "parentPath",
      "publicPath",
    ])
    .index("by_programKey_and_locale_and_kind_and_parentPath_and_publicPath", [
      "programKey",
      "locale",
      "kind",
      "parentPath",
      "publicPath",
    ])
    .index("by_materialKey_and_locale", ["materialKey", "locale"])
    .index("by_locale_and_sitemap_and_publicPath", [
      "locale",
      "sitemap",
      "publicPath",
    ])
    .index("by_syncedAt", ["syncedAt"]),
};

export default tables;
