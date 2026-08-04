import { rendererDomainValidator } from "@repo/backend/convex/contentRelease/spec";
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
  /** Present only for filesystem-owned attempt snapshots. */
  questionSetId: v.optional(v.id("questionSets")),
  questionSourcePath: v.string(),
  sectionIdentity: v.optional(v.string()),
  sectionKey: tryoutRouteKeyValidator,
  sectionOrder: v.number(),
  sectionRowHash: v.optional(v.string()),
  sourceRevision: v.string(),
  timeLimitSeconds: v.number(),
  /** Present only for filesystem-owned attempt snapshots. */
  tryoutSectionId: v.optional(v.id("tryoutSections")),
});

const tryoutChoiceSnapshotValidator = v.object({
  isCorrect: v.boolean(),
  label: v.string(),
  optionKey: v.string(),
  order: v.number(),
});

const tables = {
  /** One immutable signed renderer bundle shared by attempts from one release. */
  tryoutBundles: defineTable({
    createdAt: v.number(),
    index: v.number(),
    manifestHash: v.string(),
    releaseId: v.string(),
    releaseJson: v.string(),
    rendererJson: v.string(),
    snapshotId: v.string(),
  })
    .index("by_releaseId", ["releaseId"])
    .index("by_snapshotId_and_index", ["snapshotId", "index"]),

  tryoutAttempts: defineTable({
    userId: v.id("users"),
    /** Retained only while the matching local lookup shell exists. */
    tryoutSetId: v.optional(v.id("tryoutSets")),
    /** Present only for signed and migrated attempts. */
    tryoutSnapshotId: v.optional(v.string()),
    /** Present only for signed and migrated attempts. */
    snapshotReleaseId: v.optional(v.string()),
    setIdentity: v.optional(v.string()),
    /** Frozen localized route used to resume after a later catalog rename. */
    setPublicPath: v.optional(v.string()),
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
    .index("by_tryoutSnapshotId", ["tryoutSnapshotId"])
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
    .index("by_userId_and_locale_and_setPublicPath_and_startedAt", [
      "userId",
      "locale",
      "setPublicPath",
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
    /** Present only for filesystem-owned and migrated progress. */
    tryoutSetId: v.optional(v.id("tryoutSets")),
    /** Present only for signed and migrated progress. */
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
    .index("by_userId_and_route", [
      "userId",
      "countryKey",
      "examKey",
      "trackKey",
      "locale",
      "setKey",
    ])
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
    /** Present only for filesystem-owned and migrated section attempts. */
    tryoutSectionId: v.optional(v.id("tryoutSections")),
    sectionIdentity: v.optional(v.string()),
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
    answerArtifactHash: v.optional(v.string()),
    answerContentKey: v.optional(v.string()),
    placementIdentity: v.optional(v.string()),
    placementRowHash: v.optional(v.string()),
    questionArtifactHash: v.optional(v.string()),
    questionContentKey: v.optional(v.string()),
    rendererDomain: v.optional(rendererDomainValidator),
    sectionIdentity: v.optional(v.string()),
    sectionKey: v.optional(tryoutRouteKeyValidator),
    tryoutAttemptId: v.id("tryoutAttempts"),
    /** Present only for filesystem-owned and migrated placements. */
    tryoutSectionId: v.optional(v.id("tryoutSections")),
    /** Optional only while filesystem-owned attempts remain readable. */
    questionId: v.optional(v.id("questions")),
    /** Optional only while filesystem-owned IRT rows remain readable. */
    questionSourceKey: v.optional(v.string()),
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
    /** Optional only while filesystem-owned responses remain readable. */
    questionId: v.optional(v.id("questions")),
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
    /** Present only for filesystem-owned and migrated score snapshots. */
    tryoutSetId: v.optional(v.id("tryoutSets")),
    tryoutSnapshotId: v.optional(v.string()),
    setIdentity: v.optional(v.string()),
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
