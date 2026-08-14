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
import routeSchema from "@repo/backend/convex/contents/schema/routes";
import {
  localeValidator,
  materialDomainValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const learningPopularityWindowValidator = literals(
  ...learningPopularityWindowValues
);
const learningPopularityScopeValidator = literals(
  ...learningPopularityScopeValues
);
const legacyContentSearchDocumentValidator = v.object({
  ...contentSearchDocumentValidator.fields,
  markdown_url: v.string(),
});
const tables = {
  /**
   * Durable graph-backed learning engagement history.
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
    materialDomain: v.optional(materialDomainValidator),
    partition: v.number(),
    route: v.string(),
    section: nakafaSectionValidator,
    scopeMode: learningPopularityScopeValidator,
    sourcePath: v.string(),
    title: v.string(),
    viewerKey: v.string(),
    viewedAt: v.number(),
  })
    .index("by_partition_and_insertedAt", ["partition", "insertedAt"])
    .index("by_viewerKey", ["viewerKey"]),

  /**
   * Durable user-facing Continue Learning projection ranked by the learner's
   * latest verified view. One record per signed-in learner and canonical asset.
   * Context fields store the latest validated resume path, but never define item
   * identity. Generic content and analytics resets must preserve these rows.
   */
  userLearningRecents: defineTable({
    ...learningGraphIdentityValidator.fields,
    ...learningContextStorageFields,
    content_id: graphContentIdValidator,
    description: v.optional(v.string()),
    lastViewedAt: v.number(),
    locale: localeValidator,
    materialDomain: v.optional(materialDomainValidator),
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
    materialDomain: v.optional(materialDomainValidator),
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
    materialDomain: v.optional(materialDomainValidator),
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

  /** Retained legacy search rows with their exact pre-drain contract. */
  contentSearch: defineTable(legacyContentSearchDocumentValidator)
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

  ...routeSchema,
};

export default tables;
