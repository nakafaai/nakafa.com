import { attemptEndReasonValidator } from "@repo/backend/convex/lib/attempts";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutAccessCampaignKindValidator } from "@repo/backend/convex/tryoutAccess/schema";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const tryoutStatusValidator = literals(
  "in-progress",
  "completed",
  "expired"
);
export type TryoutStatus = Infer<typeof tryoutStatusValidator>;

export const tryoutScoreStatusValidator = literals("provisional", "official");
export type TryoutScoreStatus = Infer<typeof tryoutScoreStatusValidator>;

export const tryoutAccessKindValidator = literals("event", "subscription");
export type TryoutAccessKind = Infer<typeof tryoutAccessKindValidator>;

export const tryoutPublicResultStatusValidator = literals(
  "estimated",
  "verified-irt",
  "final-event"
);
export type TryoutPublicResultStatus = Infer<
  typeof tryoutPublicResultStatusValidator
>;

export const tryoutPartKeyValidator = v.string();
export type TryoutPartKey = Infer<typeof tryoutPartKeyValidator>;

export const tryoutCatalogStatusEntryValidator = v.object({
  expiresAtMs: v.number(),
  status: tryoutStatusValidator,
  updatedAt: v.number(),
});
export type TryoutCatalogStatusEntry = Infer<
  typeof tryoutCatalogStatusEntryValidator
>;

export const tryoutPartSnapshotValidator = v.object({
  partIndex: v.number(),
  /** Stable public identifier for one part, e.g. `general-reasoning`. */
  partKey: tryoutPartKeyValidator,
  questionCount: v.number(),
  setId: v.id("exerciseSets"),
});
export type TryoutPartSnapshot = Infer<typeof tryoutPartSnapshotValidator>;

const tables = {
  tryouts: defineTable({
    product: tryoutProductValidator,
    locale: localeValidator,
    /** Product-defined cycle identifier, e.g. `2026` or a future `2026-wave-1`. */
    cycleKey: v.string(),
    slug: v.string(),
    label: v.string(),
    partCount: v.number(),
    totalQuestionCount: v.number(),
    isActive: v.boolean(),
    detectedAt: v.number(),
    syncedAt: v.number(),
  })
    .index("by_isActive", ["isActive"])
    .index("by_product_and_isActive", ["product", "isActive"])
    .index("by_product_and_locale_and_slug", ["product", "locale", "slug"])
    .index("by_product_and_locale_and_cycleKey_and_slug", [
      "product",
      "locale",
      "cycleKey",
      "slug",
    ])
    .index("by_product_and_locale_and_isActive", [
      "product",
      "locale",
      "isActive",
    ]),

  tryoutCatalogEntries: defineTable({
    tryoutId: v.id("tryouts"),
    product: tryoutProductValidator,
    locale: localeValidator,
    cycleKey: v.string(),
    slug: v.string(),
    label: v.string(),
    partCount: v.number(),
    totalQuestionCount: v.number(),
    isActive: v.boolean(),
    catalogSortKey: v.string(),
    updatedAt: v.number(),
  })
    .index("by_tryoutId", ["tryoutId"])
    .index("by_product_and_locale_and_isActive_and_catalogSortKey", [
      "product",
      "locale",
      "isActive",
      "catalogSortKey",
    ]),

  tryoutCatalogMeta: defineTable({
    product: tryoutProductValidator,
    locale: localeValidator,
    activeCount: v.number(),
    updatedAt: v.number(),
  }).index("by_product_and_locale", ["product", "locale"]),

  tryoutPartSets: defineTable({
    tryoutId: v.id("tryouts"),
    setId: v.id("exerciseSets"),
    partIndex: v.number(),
    /** Stable public identifier for one part, e.g. `general-reasoning`. */
    partKey: tryoutPartKeyValidator,
  })
    .index("by_tryoutId_and_partIndex", ["tryoutId", "partIndex"])
    .index("by_tryoutId_and_partKey", ["tryoutId", "partKey"])
    .index("by_setId", ["setId"]),

  tryoutAttempts: defineTable({
    userId: v.id("users"),
    tryoutId: v.id("tryouts"),
    scaleVersionId: v.id("irtScaleVersions"),
    accessKind: v.optional(tryoutAccessKindValidator),
    accessCampaignId: v.optional(v.id("tryoutAccessCampaigns")),
    accessCampaignKind: v.optional(tryoutAccessCampaignKindValidator),
    accessGrantId: v.optional(v.id("tryoutAccessGrants")),
    accessEndsAt: v.optional(v.number()),
    countsForCompetition: v.optional(v.boolean()),
    scoreStatus: tryoutScoreStatusValidator,
    status: tryoutStatusValidator,
    partSetSnapshots: v.array(tryoutPartSnapshotValidator),
    completedPartIndices: v.array(v.number()),
    totalCorrect: v.number(),
    totalQuestions: v.number(),
    theta: v.number(),
    thetaSE: v.number(),
    startedAt: v.number(),
    expiresAt: v.number(),
    lastActivityAt: v.number(),
    completedAt: v.union(v.number(), v.null()),
    endReason: v.union(attemptEndReasonValidator, v.null()),
  })
    .index("by_status_and_expiresAt", ["status", "expiresAt"])
    .index("by_userId_and_startedAt", ["userId", "startedAt"])
    .index("by_userId_and_status_and_expiresAt", [
      "userId",
      "status",
      "expiresAt",
    ])
    .index("by_userId_and_tryoutId_and_startedAt", [
      "userId",
      "tryoutId",
      "startedAt",
    ])
    .index("by_userId_and_tryoutId_and_accessCampaignId_and_startedAt", [
      "userId",
      "tryoutId",
      "accessCampaignId",
      "startedAt",
    ])
    .index("by_accessCampaignId_and_startedAt", [
      "accessCampaignId",
      "startedAt",
    ])
    .index("by_tryoutId_and_scoreStatus_and_status_and_startedAt", [
      "tryoutId",
      "scoreStatus",
      "status",
      "startedAt",
    ]),

  userTryoutControls: defineTable({
    userId: v.id("users"),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  tryoutPartAttempts: defineTable({
    tryoutAttemptId: v.id("tryoutAttempts"),
    partIndex: v.number(),
    /** Snapshot of the stable public part identifier used when the attempt started. */
    partKey: tryoutPartKeyValidator,
    setAttemptId: v.id("exerciseAttempts"),
    setId: v.id("exerciseSets"),
    theta: v.number(),
    thetaSE: v.number(),
  })
    .index("by_tryoutAttemptId_and_partIndex", ["tryoutAttemptId", "partIndex"])
    .index("by_setAttemptId", ["setAttemptId"]),

  userTryoutStats: defineTable({
    userId: v.id("users"),
    product: tryoutProductValidator,
    leaderboardNamespace: v.string(),
    totalTryoutsCompleted: v.number(),
    averageTheta: v.number(),
    bestTheta: v.number(),
    averageRawScore: v.number(),
    lastTryoutAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId_and_product_and_leaderboardNamespace", [
    "userId",
    "product",
    "leaderboardNamespace",
  ]),

  tryoutLeaderboardEntries: defineTable({
    tryoutId: v.id("tryouts"),
    userId: v.id("users"),
    leaderboardNamespace: v.string(),
    theta: v.number(),
    thetaSE: v.number(),
    rawScore: v.number(),
    completedAt: v.number(),
    attemptId: v.id("tryoutAttempts"),
  })
    .index("by_tryoutId_and_userId", ["tryoutId", "userId"])
    .index("by_userId_and_leaderboardNamespace_and_completedAt", [
      "userId",
      "leaderboardNamespace",
      "completedAt",
    ])
    .index("by_userId_and_leaderboardNamespace_and_theta", [
      "userId",
      "leaderboardNamespace",
      "theta",
    ]),
};

export default tables;
