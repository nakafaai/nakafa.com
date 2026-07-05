import { attemptEndReasonValidator } from "@repo/backend/convex/lib/attempts";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
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

export const tryoutScoringStrategyValidator = literals(
  "irt",
  "raw",
  "weighted"
);
export type TryoutScoringStrategy = Infer<
  typeof tryoutScoringStrategyValidator
>;

export const tryoutPublicResultStatusValidator = literals(
  "estimated",
  "verified-irt",
  "final-event"
);
export type TryoutPublicResultStatus = Infer<
  typeof tryoutPublicResultStatusValidator
>;

export const tryoutRouteKeyValidator = v.string();
export type TryoutRouteKey = Infer<typeof tryoutRouteKeyValidator>;

export const tryoutSectionSnapshotValidator = v.object({
  questionCount: v.number(),
  sectionKey: tryoutRouteKeyValidator,
  sectionOrder: v.number(),
  tryoutSectionId: v.id("tryoutSections"),
});
export type TryoutSectionSnapshot = Infer<
  typeof tryoutSectionSnapshotValidator
>;

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

  tryoutSets: defineTable({
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    locale: localeValidator,
    publicPath: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    scoringStrategy: tryoutScoringStrategyValidator,
    sectionCount: v.number(),
    totalQuestionCount: v.number(),
    order: v.number(),
    isActive: v.boolean(),
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
    .index("by_countryKey_and_examKey_and_setKey_and_locale", [
      "countryKey",
      "examKey",
      "setKey",
      "locale",
    ]),

  tryoutSections: defineTable({
    tryoutSetId: v.id("tryoutSets"),
    questionSetId: v.id("questionSets"),
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    sectionKey: tryoutRouteKeyValidator,
    locale: localeValidator,
    publicPath: v.string(),
    questionSourcePath: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    questionCount: v.number(),
    order: v.number(),
    sourceRevision: v.string(),
    syncedAt: v.number(),
  })
    .index("by_locale_and_publicPath", ["locale", "publicPath"])
    .index("by_tryoutSetId_and_order", ["tryoutSetId", "order"])
    .index("by_tryoutSetId_and_sectionKey", ["tryoutSetId", "sectionKey"])
    .index("by_questionSetId", ["questionSetId"]),

  tryoutAttempts: defineTable({
    userId: v.id("users"),
    tryoutSetId: v.id("tryoutSets"),
    scaleVersionId: v.optional(v.id("irtScaleVersions")),
    accessKind: v.optional(tryoutAccessKindValidator),
    accessCampaignId: v.optional(v.id("tryoutAccessCampaigns")),
    accessGrantId: v.optional(v.id("tryoutAccessGrants")),
    accessEndsAt: v.optional(v.number()),
    countsForCompetition: v.optional(v.boolean()),
    scoreStatus: tryoutScoreStatusValidator,
    status: tryoutStatusValidator,
    sectionSnapshots: v.array(tryoutSectionSnapshotValidator),
    completedSectionKeys: v.array(tryoutRouteKeyValidator),
    attemptNumber: v.number(),
    totalCorrect: v.number(),
    totalQuestions: v.number(),
    theta: v.optional(v.number()),
    thetaSE: v.optional(v.number()),
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
    .index("by_userId_and_tryoutSetId_and_startedAt", [
      "userId",
      "tryoutSetId",
      "startedAt",
    ])
    .index("by_accessCampaignId_and_startedAt", [
      "accessCampaignId",
      "startedAt",
    ])
    .index("by_tryoutSetId_and_scoreStatus_and_status_and_startedAt", [
      "tryoutSetId",
      "scoreStatus",
      "status",
      "startedAt",
    ]),

  tryoutSectionAttempts: defineTable({
    tryoutAttemptId: v.id("tryoutAttempts"),
    tryoutSectionId: v.id("tryoutSections"),
    sectionKey: tryoutRouteKeyValidator,
    sectionOrder: v.number(),
    status: tryoutStatusValidator,
    startedAt: v.number(),
    expiresAt: v.number(),
    completedAt: v.union(v.number(), v.null()),
    endReason: v.union(attemptEndReasonValidator, v.null()),
    lastActivityAt: v.number(),
    totalQuestions: v.number(),
    answeredCount: v.number(),
    correctAnswers: v.number(),
    theta: v.optional(v.number()),
    thetaSE: v.optional(v.number()),
  })
    .index("by_tryoutAttemptId_and_sectionOrder", [
      "tryoutAttemptId",
      "sectionOrder",
    ])
    .index("by_tryoutAttemptId_and_sectionKey", [
      "tryoutAttemptId",
      "sectionKey",
    ])
    .index("by_status_and_expiresAt", ["status", "expiresAt"]),

  tryoutAttemptPlacements: defineTable({
    tryoutAttemptId: v.id("tryoutAttempts"),
    tryoutSectionAttemptId: v.id("tryoutSectionAttempts"),
    tryoutSectionId: v.id("tryoutSections"),
    questionId: v.id("questions"),
    questionSourceKey: v.string(),
    questionOrder: v.number(),
    sourceRevision: v.string(),
    contentHash: v.string(),
  })
    .index("by_tryoutAttemptId_and_questionOrder", [
      "tryoutAttemptId",
      "questionOrder",
    ])
    .index("by_tryoutSectionAttemptId_and_questionOrder", [
      "tryoutSectionAttemptId",
      "questionOrder",
    ])
    .index("by_questionId", ["questionId"]),

  tryoutResponses: defineTable({
    tryoutAttemptId: v.id("tryoutAttempts"),
    tryoutSectionAttemptId: v.id("tryoutSectionAttempts"),
    placementId: v.id("tryoutAttemptPlacements"),
    questionId: v.id("questions"),
    selectedOptionId: v.optional(v.string()),
    textAnswer: v.optional(v.string()),
    isCorrect: v.boolean(),
    timeSpent: v.number(),
    answeredAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tryoutSectionAttemptId_and_questionId", [
      "tryoutSectionAttemptId",
      "questionId",
    ])
    .index("by_tryoutAttemptId_and_questionId", [
      "tryoutAttemptId",
      "questionId",
    ])
    .index("by_placementId", ["placementId"]),

  tryoutScores: defineTable({
    tryoutAttemptId: v.id("tryoutAttempts"),
    tryoutSetId: v.id("tryoutSets"),
    userId: v.id("users"),
    scoringStrategy: tryoutScoringStrategyValidator,
    scoreStatus: tryoutScoreStatusValidator,
    scaleVersionId: v.optional(v.id("irtScaleVersions")),
    rawScore: v.number(),
    totalCorrect: v.number(),
    totalQuestions: v.number(),
    theta: v.optional(v.number()),
    thetaSE: v.optional(v.number()),
    publishedScore: v.number(),
    finalizedAt: v.number(),
  })
    .index("by_tryoutAttemptId", ["tryoutAttemptId"])
    .index("by_tryoutSetId_and_scoreStatus_and_finalizedAt", [
      "tryoutSetId",
      "scoreStatus",
      "finalizedAt",
    ])
    .index("by_userId_and_finalizedAt", ["userId", "finalizedAt"]),

  tryoutLeaderboardScopes: defineTable({
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    setKey: v.optional(tryoutRouteKeyValidator),
    locale: localeValidator,
    sourceRevision: v.string(),
    syncedAt: v.number(),
  }).index("by_countryKey_and_examKey_and_setKey_and_locale", [
    "countryKey",
    "examKey",
    "setKey",
    "locale",
  ]),

  tryoutLeaderboardUserStats: defineTable({
    userId: v.id("users"),
    leaderboardScopeId: v.id("tryoutLeaderboardScopes"),
    totalTryoutsCompleted: v.number(),
    averageScore: v.number(),
    bestScore: v.number(),
    averageRawScore: v.number(),
    lastTryoutAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId_and_leaderboardScopeId", [
    "userId",
    "leaderboardScopeId",
  ]),

  tryoutLeaderboardEntries: defineTable({
    tryoutSetId: v.id("tryoutSets"),
    userId: v.id("users"),
    leaderboardScopeId: v.id("tryoutLeaderboardScopes"),
    publishedScore: v.number(),
    theta: v.optional(v.number()),
    thetaSE: v.optional(v.number()),
    rawScore: v.number(),
    completedAt: v.number(),
    attemptId: v.id("tryoutAttempts"),
  })
    .index("by_tryoutSetId_and_userId", ["tryoutSetId", "userId"])
    .index("by_userId_and_leaderboardScopeId_and_completedAt", [
      "userId",
      "leaderboardScopeId",
      "completedAt",
    ])
    .index("by_leaderboardScopeId_and_publishedScore", [
      "leaderboardScopeId",
      "publishedScore",
    ]),
};

export default tables;
