import { attemptEndReasonValidator } from "@repo/backend/convex/lib/attempts";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
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

export const tryoutPartKeyValidator = v.string();
export type TryoutPartKey = Infer<typeof tryoutPartKeyValidator>;

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
    .index("isActive", ["isActive"])
    .index("product_locale_slug", ["product", "locale", "slug"])
    .index("product_locale_cycleKey_slug", [
      "product",
      "locale",
      "cycleKey",
      "slug",
    ])
    .index("product_locale_isActive", ["product", "locale", "isActive"]),

  tryoutPartSets: defineTable({
    tryoutId: v.id("tryouts"),
    setId: v.id("exerciseSets"),
    partIndex: v.number(),
    /** Stable public identifier for one part, e.g. `general-reasoning`. */
    partKey: tryoutPartKeyValidator,
  })
    .index("tryoutId_partIndex", ["tryoutId", "partIndex"])
    .index("tryoutId_partKey", ["tryoutId", "partKey"])
    .index("setId", ["setId"]),

  tryoutAttempts: defineTable({
    userId: v.id("users"),
    tryoutId: v.id("tryouts"),
    scaleVersionId: v.id("irtScaleVersions"),
    scoreStatus: tryoutScoreStatusValidator,
    status: tryoutStatusValidator,
    completedPartIndices: v.array(v.number()),
    totalCorrect: v.number(),
    totalQuestions: v.number(),
    theta: v.number(),
    thetaSE: v.number(),
    irtScore: v.number(),
    startedAt: v.number(),
    expiresAt: v.number(),
    lastActivityAt: v.number(),
    completedAt: v.union(v.number(), v.null()),
    endReason: v.union(attemptEndReasonValidator, v.null()),
  })
    .index("status_expiresAt", ["status", "expiresAt"])
    .index("userId_status_expiresAt", ["userId", "status", "expiresAt"])
    .index("userId_tryoutId_startedAt", ["userId", "tryoutId", "startedAt"])
    .index("tryoutId_scoreStatus_status_startedAt", [
      "tryoutId",
      "scoreStatus",
      "status",
      "startedAt",
    ]),

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
    .index("tryoutAttemptId_partIndex", ["tryoutAttemptId", "partIndex"])
    .index("tryoutAttemptId_partKey", ["tryoutAttemptId", "partKey"])
    .index("setAttemptId", ["setAttemptId"]),

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
  }).index("userId_product_leaderboardNamespace", [
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
    irtScore: v.number(),
    rawScore: v.number(),
    completedAt: v.number(),
    attemptId: v.id("tryoutAttempts"),
  })
    .index("tryoutId_userId", ["tryoutId", "userId"])
    .index("userId_leaderboardNamespace_completedAt", [
      "userId",
      "leaderboardNamespace",
      "completedAt",
    ])
    .index("userId_leaderboardNamespace_theta", [
      "userId",
      "leaderboardNamespace",
      "theta",
    ]),
};

export default tables;
