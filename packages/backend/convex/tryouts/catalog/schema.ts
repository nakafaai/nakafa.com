import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  tryoutSectionVisibilityValidator,
  tryoutTrackKindValidator,
} from "@repo/backend/convex/tryouts/catalog/spec";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { tryoutScoringStrategyValidator } from "@repo/backend/convex/tryouts/score";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  tryoutCountries: defineTable({
    countryKey: tryoutRouteKeyValidator,
    locale: localeValidator,
    publicPath: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
    isActive: v.boolean(),
    sourceRevision: v.string(),
    syncedAt: v.number(),
  })
    .index("by_locale_and_publicPath", ["locale", "publicPath"])
    .index("by_countryKey_and_locale", ["countryKey", "locale"])
    .index("by_locale_and_isActive_and_order", ["locale", "isActive", "order"]),

  tryoutExams: defineTable({
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    locale: localeValidator,
    publicPath: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    scoringStrategy: tryoutScoringStrategyValidator,
    order: v.number(),
    isActive: v.boolean(),
    sourceRevision: v.string(),
    syncedAt: v.number(),
  })
    .index("by_locale_and_publicPath", ["locale", "publicPath"])
    .index("by_countryKey_and_locale_and_isActive_and_order", [
      "countryKey",
      "locale",
      "isActive",
      "order",
    ])
    .index("by_countryKey_and_examKey_and_locale", [
      "countryKey",
      "examKey",
      "locale",
    ]),

  tryoutTracks: defineTable({
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
    trackKind: tryoutTrackKindValidator,
    locale: localeValidator,
    publicPath: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    authoredSetCount: v.number(),
    readyQuestionCount: v.number(),
    readySetCount: v.number(),
    readyVisibleSectionCount: v.number(),
    order: v.number(),
    isActive: v.boolean(),
    isReady: v.boolean(),
    sourceRevision: v.string(),
    syncedAt: v.number(),
  })
    .index("by_locale_and_publicPath", ["locale", "publicPath"])
    .index("by_countryKey_and_examKey_and_locale_and_isActive_and_order", [
      "countryKey",
      "examKey",
      "locale",
      "isActive",
      "order",
    ])
    .index("by_countryKey_and_examKey_and_trackKey_and_locale", [
      "countryKey",
      "examKey",
      "trackKey",
      "locale",
    ]),

  tryoutSets: defineTable({
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    locale: localeValidator,
    publicPath: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    scoringStrategy: tryoutScoringStrategyValidator,
    internalEntrySectionKey: v.optional(tryoutRouteKeyValidator),
    readyQuestionCount: v.number(),
    readyVisibleSectionCount: v.number(),
    sectionCount: v.number(),
    totalQuestionCount: v.number(),
    visibleSectionCount: v.number(),
    order: v.number(),
    isActive: v.boolean(),
    isReady: v.boolean(),
    sourceRevision: v.string(),
    syncedAt: v.number(),
  })
    .index("by_locale_and_publicPath", ["locale", "publicPath"])
    .index("by_track_locale_active_ready_order", [
      "countryKey",
      "examKey",
      "trackKey",
      "locale",
      "isActive",
      "isReady",
      "order",
    ])
    .index("by_track_locale_active_ready_title", [
      "countryKey",
      "examKey",
      "trackKey",
      "locale",
      "isActive",
      "isReady",
      "title",
    ])
    .index("by_track_locale_active_ready_questions", [
      "countryKey",
      "examKey",
      "trackKey",
      "locale",
      "isActive",
      "isReady",
      "readyQuestionCount",
    ])
    .index("by_countryKey_and_examKey_and_trackKey_and_setKey_and_locale", [
      "countryKey",
      "examKey",
      "trackKey",
      "setKey",
      "locale",
    ]),

  tryoutSections: defineTable({
    tryoutSetId: v.id("tryoutSets"),
    questionSetId: v.id("questionSets"),
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    sectionKey: tryoutRouteKeyValidator,
    locale: localeValidator,
    publicPath: v.optional(v.string()),
    questionSourcePath: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    questionCount: v.number(),
    order: v.number(),
    sourceRevision: v.string(),
    timeLimitSeconds: v.number(),
    syncedAt: v.number(),
    visibility: tryoutSectionVisibilityValidator,
  })
    .index("by_locale_and_publicPath", ["locale", "publicPath"])
    .index("by_tryoutSetId_and_order", ["tryoutSetId", "order"])
    .index("by_tryoutSetId_and_sectionKey", ["tryoutSetId", "sectionKey"])
    .index("by_questionSetId", ["questionSetId"]),
};

export default tables;
