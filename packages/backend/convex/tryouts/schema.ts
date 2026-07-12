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

export const tryoutStatusRankValidator = literals(1, 2, 3);
export type TryoutStatusRank = Infer<typeof tryoutStatusRankValidator>;

export const tryoutScoreStatusValidator = literals("provisional", "official");
export type TryoutScoreStatus = Infer<typeof tryoutScoreStatusValidator>;

export const tryoutScoringStrategyValidator = literals(
  "irt",
  "raw",
  "weighted"
);
export type TryoutScoringStrategy = Infer<
  typeof tryoutScoringStrategyValidator
>;

const tryoutScoreValueValidators = {
  publishedScore: v.number(),
  rawScore: v.number(),
  scoreStatus: tryoutScoreStatusValidator,
  scoringStrategy: tryoutScoringStrategyValidator,
  theta: v.optional(v.number()),
  thetaSE: v.optional(v.number()),
};

export const tryoutSectionScoreValidator = v.object(tryoutScoreValueValidators);
export type TryoutSectionScore = Infer<typeof tryoutSectionScoreValidator>;

export const tryoutScoreResultValidator = v.object({
  ...tryoutScoreValueValidators,
  totalCorrect: v.number(),
  totalQuestions: v.number(),
});
export type TryoutScoreResult = Infer<typeof tryoutScoreResultValidator>;

export const tryoutRouteKeyValidator = v.string();
export type TryoutRouteKey = Infer<typeof tryoutRouteKeyValidator>;

export const tryoutTrackKindValidator = literals("subject", "year");
export type TryoutTrackKind = Infer<typeof tryoutTrackKindValidator>;

export const tryoutSectionVisibilityValidator = literals(
  "internal-entry",
  "visible"
);
export type TryoutSectionVisibility = Infer<
  typeof tryoutSectionVisibilityValidator
>;

export const tryoutSectionSnapshotValidator = v.object({
  publicPath: v.optional(v.string()),
  questionCount: v.number(),
  questionSetId: v.id("questionSets"),
  questionSourcePath: v.string(),
  sectionKey: tryoutRouteKeyValidator,
  sectionOrder: v.number(),
  sourceRevision: v.string(),
  timeLimitSeconds: v.number(),
  tryoutSectionId: v.id("tryoutSections"),
});
export type TryoutSectionSnapshot = Infer<
  typeof tryoutSectionSnapshotValidator
>;

export const tryoutChoiceSnapshotValidator = v.object({
  isCorrect: v.boolean(),
  label: v.string(),
  optionKey: v.string(),
  order: v.number(),
});
export type TryoutChoiceSnapshot = Infer<typeof tryoutChoiceSnapshotValidator>;

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

  tryoutAttempts: defineTable({
    userId: v.id("users"),
    tryoutSetId: v.id("tryoutSets"),
    scaleVersionId: v.optional(v.id("irtScaleVersions")),
    accessCampaignId: v.optional(v.id("tryoutAccessCampaigns")),
    accessGrantId: v.optional(v.id("tryoutAccessGrants")),
    accessSubscriptionId: v.optional(v.string()),
    accessEndsAt: v.optional(v.number()),
    countsForCompetition: v.optional(v.boolean()),
    scoreStatus: tryoutScoreStatusValidator,
    scoringStrategy: tryoutScoringStrategyValidator,
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

  tryoutSetProgress: defineTable({
    userId: v.id("users"),
    tryoutSetId: v.id("tryoutSets"),
    latestAttemptId: v.id("tryoutAttempts"),
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    locale: localeValidator,
    attemptNumber: v.number(),
    publishedScore: v.union(v.number(), v.null()),
    status: tryoutStatusValidator,
    statusRank: tryoutStatusRankValidator,
    updatedAt: v.number(),
  })
    .index("by_userId_and_tryoutSetId", ["userId", "tryoutSetId"])
    .index(
      "by_userId_and_countryKey_and_examKey_and_trackKey_and_locale_and_publishedScore_and_setKey",
      [
        "userId",
        "countryKey",
        "examKey",
        "trackKey",
        "locale",
        "publishedScore",
        "setKey",
      ]
    )
    .index("by_userId_and_track_and_statusRank_and_setKey", [
      "userId",
      "countryKey",
      "examKey",
      "trackKey",
      "locale",
      "statusRank",
      "setKey",
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
    score: v.optional(tryoutSectionScoreValidator),
  })
    .index("by_tryoutAttemptId_and_sectionOrder", [
      "tryoutAttemptId",
      "sectionOrder",
    ])
    .index("by_tryoutAttemptId_and_sectionKey", [
      "tryoutAttemptId",
      "sectionKey",
    ])
    .index("by_tryoutAttemptId_and_tryoutSectionId", [
      "tryoutAttemptId",
      "tryoutSectionId",
    ])
    .index("by_status_and_expiresAt", ["status", "expiresAt"]),

  tryoutAttemptPlacements: defineTable({
    tryoutAttemptId: v.id("tryoutAttempts"),
    tryoutSectionId: v.id("tryoutSections"),
    questionId: v.id("questions"),
    questionSourceKey: v.string(),
    questionOrder: v.number(),
    sourcePath: v.string(),
    title: v.string(),
    choiceSnapshots: v.array(tryoutChoiceSnapshotValidator),
    sourceRevision: v.string(),
    contentHash: v.string(),
  })
    .index("by_tryoutAttemptId_and_questionOrder", [
      "tryoutAttemptId",
      "questionOrder",
    ])
    .index("by_tryoutAttemptId_and_tryoutSectionId_and_questionOrder", [
      "tryoutAttemptId",
      "tryoutSectionId",
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
