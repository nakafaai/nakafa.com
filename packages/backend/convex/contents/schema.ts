import { CONTENT_ROUTE_KINDS } from "@repo/backend/convex/contents/constants";
import { learningContextStorageFields } from "@repo/backend/convex/contents/context";
import {
  graphContentIdValidator,
  learningGraphIdentityValidator,
} from "@repo/backend/convex/contents/graph";
import { contentSearchDocumentValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import {
  learningPopularityScopeValues,
  learningPopularityWindowValues,
} from "@repo/backend/convex/contents/popularity";
import {
  localeValidator,
  materialValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import {
  PROGRAM_NAVIGATION_ICON_KEY_VALUES,
  PROGRAM_NAVIGATION_LEVEL_VALUES,
} from "@repo/contents/_types/program/schema";
import { PUBLIC_ROUTE_KIND_VALUES } from "@repo/contents/_types/route/schema";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const contentRouteKindValidator = literals(...CONTENT_ROUTE_KINDS);
const navigationIconKeyValidator = literals(
  ...PROGRAM_NAVIGATION_ICON_KEY_VALUES
);
const navigationLevelValidator = literals(...PROGRAM_NAVIGATION_LEVEL_VALUES);
const publicRouteKindValidator = literals(...PUBLIC_ROUTE_KIND_VALUES);
const learningPopularityWindowValidator = literals(
  ...learningPopularityWindowValues
);
const learningPopularityScopeValidator = literals(
  ...learningPopularityScopeValues
);
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
   * Graph-backed learning engagement read model.
   * One record per anonymous device or authenticated user-device for each
   * canonical asset and verified context.
   * `route` is a display/navigation projection; `content_id` is the graph asset ID.
   */
  learningViews: defineTable({
    ...learningGraphIdentityValidator.fields,
    ...learningContextStorageFields,
    content_id: graphContentIdValidator,
    deviceId: v.string(),
    firstViewedAt: v.number(),
    lastViewedAt: v.number(),
    locale: localeValidator,
    route: v.string(),
    section: nakafaSectionValidator,
    userId: v.optional(v.id("users")),
  })
    .index("by_userId_and_content_id_and_contextKey", [
      "userId",
      "content_id",
      "contextKey",
    ])
    .index("by_userId_and_deviceId_and_content_id_and_contextKey", [
      "userId",
      "deviceId",
      "content_id",
      "contextKey",
    ])
    .index("by_userId_and_section_and_locale_and_lastViewedAt", [
      "userId",
      "section",
      "locale",
      "lastViewedAt",
    ])
    .index("by_deviceId_and_content_id_and_contextKey", [
      "deviceId",
      "content_id",
      "contextKey",
    ])
    .index("by_deviceId_and_content_id_and_contextKey_and_lastViewedAt", [
      "deviceId",
      "content_id",
      "contextKey",
      "lastViewedAt",
    ])
    .index("by_locale_and_section_and_lastViewedAt", [
      "locale",
      "section",
      "lastViewedAt",
    ]),

  /**
   * Append-only queue of new unique learning engagement events.
   * Queue rows are partitioned so background processors can drain them in parallel.
   * Rows carry graph identity so analytics never resolves product identity from routes.
   */
  learningEngagementQueue: defineTable({
    ...learningGraphIdentityValidator.fields,
    ...learningContextStorageFields,
    content_id: graphContentIdValidator,
    description: v.optional(v.string()),
    insertedAt: v.number(),
    locale: localeValidator,
    materialDomain: v.optional(materialValidator),
    partition: v.number(),
    route: v.string(),
    section: nakafaSectionValidator,
    scopeMode: learningPopularityScopeValidator,
    sourcePath: v.string(),
    title: v.string(),
    viewerKey: v.string(),
    viewedAt: v.number(),
  }).index("by_partition_and_insertedAt", ["partition", "insertedAt"]),

  /**
   * Continue Learning read model ranked by the learner's latest verified view.
   * One record per signed-in learner and canonical asset. Context fields store
   * the latest validated resume path, but never define item identity.
   */
  userLearningRecents: defineTable({
    ...learningGraphIdentityValidator.fields,
    ...learningContextStorageFields,
    content_id: graphContentIdValidator,
    description: v.optional(v.string()),
    lastViewedAt: v.number(),
    locale: localeValidator,
    materialDomain: v.optional(materialValidator),
    route: v.string(),
    section: nakafaSectionValidator,
    sourcePath: v.string(),
    title: v.string(),
    userId: v.id("users"),
  })
    .index("by_userId_and_content_id", ["userId", "content_id"])
    .index("by_userId_and_locale_and_section_and_lastViewedAt", [
      "userId",
      "locale",
      "section",
      "lastViewedAt",
    ]),

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
   * Daily viewer de-duplication for popularity signals.
   * One row means that viewer already contributed to the scope on that day.
   */
  learningPopularityViewerSignals: defineTable({
    ...learningGraphIdentityValidator.fields,
    ...learningContextStorageFields,
    content_id: graphContentIdValidator,
    locale: localeValidator,
    scopeMode: learningPopularityScopeValidator,
    section: nakafaSectionValidator,
    signalDay: v.number(),
    viewedAt: v.number(),
    viewerKey: v.string(),
  })
    .index("by_viewer_content_day_scope_context", [
      "viewerKey",
      "content_id",
      "signalDay",
      "scopeMode",
      "contextKey",
    ])
    .index("by_section_and_locale_and_scopeMode_and_signalDay", [
      "section",
      "locale",
      "scopeMode",
      "signalDay",
    ]),

  /**
   * Daily verified popularity signals used for audited window rebuilds.
   */
  learningPopularitySignals: defineTable({
    ...learningGraphIdentityValidator.fields,
    ...learningContextStorageFields,
    content_id: graphContentIdValidator,
    description: v.optional(v.string()),
    locale: localeValidator,
    materialDomain: v.optional(materialValidator),
    route: v.string(),
    section: nakafaSectionValidator,
    scopeMode: learningPopularityScopeValidator,
    signalDay: v.number(),
    sourcePath: v.string(),
    title: v.string(),
    updatedAt: v.number(),
    viewCount: v.number(),
  })
    .index("by_scopeMode_and_signalDay_and_content_id_and_contextKey", [
      "scopeMode",
      "signalDay",
      "content_id",
      "contextKey",
    ])
    .index("by_scopeMode_and_content_id_and_contextKey_and_signalDay", [
      "scopeMode",
      "content_id",
      "contextKey",
      "signalDay",
    ])
    .index("by_section_and_locale_and_scopeMode_and_signalDay", [
      "section",
      "locale",
      "scopeMode",
      "signalDay",
    ]),

  /**
   * Ranked popularity read model for bounded homepage and route queries.
   */
  learningPopularityCounters: defineTable({
    ...learningGraphIdentityValidator.fields,
    ...learningContextStorageFields,
    content_id: graphContentIdValidator,
    description: v.optional(v.string()),
    locale: localeValidator,
    materialDomain: v.optional(materialValidator),
    route: v.string(),
    score: v.number(),
    section: nakafaSectionValidator,
    scopeMode: learningPopularityScopeValidator,
    sourcePath: v.string(),
    title: v.string(),
    updatedAt: v.number(),
    windowKey: learningPopularityWindowValidator,
  })
    .index("by_windowKey_and_scopeMode_and_content_id_and_contextKey", [
      "windowKey",
      "scopeMode",
      "content_id",
      "contextKey",
    ])
    .index("by_section_locale_scope_window_score_id", [
      "section",
      "locale",
      "scopeMode",
      "windowKey",
      "score",
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
   * Source-owned public route projection for material, curriculum, and
   * try-out surfaces.
   *
   * These rows are not graph content bodies. They are the durable route
   * contract used by app routing, SEO artifacts, assistant context, and
   * curriculum navigation.
   */
  publicRoutes: defineTable({
    canonicalPath: v.optional(v.string()),
    description: v.optional(v.string()),
    displayGroupIconKey: v.optional(navigationIconKeyValidator),
    displayGroupTitle: v.optional(v.string()),
    iconKey: v.optional(navigationIconKeyValidator),
    kind: publicRouteKindValidator,
    level: v.optional(navigationLevelValidator),
    locale: localeValidator,
    materialCardDescription: v.optional(v.string()),
    materialCardTitle: v.optional(v.string()),
    materialDomain: v.optional(materialValidator),
    materialKey: v.optional(v.string()),
    nodeKey: v.optional(v.string()),
    order: v.optional(v.number()),
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
    .index("by_programKey_and_locale_and_parentPath_and_order", [
      "programKey",
      "locale",
      "parentPath",
      "order",
    ])
    .index("by_programKey_and_locale_and_kind_and_parentPath_and_publicPath", [
      "programKey",
      "locale",
      "kind",
      "parentPath",
      "publicPath",
    ])
    .index("by_materialKey_and_locale", ["materialKey", "locale"])
    .index("by_locale_and_sourcePath", ["locale", "sourcePath"])
    .index("by_locale_and_sitemap_and_publicPath", [
      "locale",
      "sitemap",
      "publicPath",
    ])
    .index("by_syncedAt", ["syncedAt"]),
};

export default tables;
