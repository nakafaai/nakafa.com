import { attemptEndReasonValidator } from "@repo/backend/convex/lib/attempts";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutAttemptAccessSourceKindValidator } from "@repo/backend/convex/tryouts/access/source";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import {
  tryoutScoreStatusValidator,
  tryoutScoringStrategyValidator,
  tryoutSectionScoreValidator,
} from "@repo/backend/convex/tryouts/score";
import {
  tryoutStatusRankValidator,
  tryoutStatusValidator,
} from "@repo/backend/convex/tryouts/status";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tryoutSectionSnapshotValidator = v.object({
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

const tryoutChoiceSnapshotValidator = v.object({
  isCorrect: v.boolean(),
  label: v.string(),
  optionKey: v.string(),
  order: v.number(),
});

const tables = {
  tryoutAttempts: defineTable({
    userId: v.id("users"),
    tryoutSetId: v.id("tryoutSets"),
    /** Optional only during the stable Aksara identity backfill. */
    tryoutSnapshotId: v.optional(v.string()),
    setIdentity: v.optional(v.string()),
    countryKey: v.optional(tryoutRouteKeyValidator),
    examKey: v.optional(tryoutRouteKeyValidator),
    trackKey: v.optional(tryoutRouteKeyValidator),
    setKey: v.optional(tryoutRouteKeyValidator),
    locale: v.optional(localeValidator),
    scaleVersionId: v.optional(v.id("irtScaleVersions")),
    accessCampaignId: v.optional(v.id("tryoutAccessCampaigns")),
    accessGrantId: v.optional(v.id("tryoutAccessGrants")),
    accessSubscriptionId: v.optional(v.string()),
    accessEndsAt: v.number(),
    accessSourceKind: tryoutAttemptAccessSourceKindValidator,
    countsForCompetition: v.boolean(),
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
    .index("by_userId_and_setIdentity_and_startedAt", [
      "userId",
      "setIdentity",
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
    ])
    .index("by_setIdentity_and_scoreStatus_and_status_and_startedAt", [
      "setIdentity",
      "scoreStatus",
      "status",
      "startedAt",
    ]),

  tryoutSetProgress: defineTable({
    userId: v.id("users"),
    tryoutSetId: v.id("tryoutSets"),
    /** Optional only during the stable Aksara identity backfill. */
    setIdentity: v.optional(v.string()),
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
    .index("by_userId_and_setIdentity", ["userId", "setIdentity"])
    .index("by_userId_and_track_and_publishedScore_and_setKey", [
      "userId",
      "countryKey",
      "examKey",
      "trackKey",
      "locale",
      "publishedScore",
      "setKey",
    ])
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
    placementIdentity: v.optional(v.string()),
    placementRowHash: v.optional(v.string()),
    sectionKey: v.optional(tryoutRouteKeyValidator),
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
    .index("by_tryoutAttemptId_and_sectionKey_and_questionOrder", [
      "tryoutAttemptId",
      "sectionKey",
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
};

export default tables;
