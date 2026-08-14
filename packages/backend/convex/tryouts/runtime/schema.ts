import { rendererDomainValidator } from "@repo/backend/convex/contentRelease/spec";
import { attemptEndReasonValidator } from "@repo/backend/convex/lib/attempts";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutAttemptAccessSourceKindValidator } from "@repo/backend/convex/tryouts/access/source";
import tryoutHistorySchema from "@repo/backend/convex/tryouts/history/schema";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { tryoutChoiceSnapshotValidator } from "@repo/backend/convex/tryouts/runtime/choice";
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
  questionSourcePath: v.string(),
  sectionIdentity: v.string(),
  sectionKey: tryoutRouteKeyValidator,
  sectionOrder: v.number(),
  sectionRowHash: v.string(),
  sourceRevision: v.string(),
  timeLimitSeconds: v.number(),
});

/** Signed release bundles required by protected content-runtime reads. */
export const tryoutBundleSchema = {
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
};

const tables = {
  ...tryoutBundleSchema,
  ...tryoutHistorySchema,
  tryoutAttempts: defineTable({
    userId: v.id("users"),
    tryoutSnapshotId: v.string(),
    snapshotReleaseId: v.string(),
    setIdentity: v.string(),
    /** Frozen localized route used to resume after a later catalog rename. */
    setPublicPath: v.string(),
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    appLocale: v.optional(localeValidator),
    locale: localeValidator,
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
    .index("by_userId_and_setIdentity_and_startedAt", [
      "userId",
      "setIdentity",
      "startedAt",
    ])
    .index("by_accessCampaignId_and_startedAt", [
      "accessCampaignId",
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
    setIdentity: v.string(),
    latestAttemptId: v.id("tryoutAttempts"),
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    appLocale: v.optional(localeValidator),
    locale: localeValidator,
    attemptNumber: v.number(),
    publishedScore: v.union(v.number(), v.null()),
    status: tryoutStatusValidator,
    statusRank: tryoutStatusRankValidator,
    updatedAt: v.number(),
  })
    .index("by_userId_and_setIdentity", ["userId", "setIdentity"])
    .index("by_userId_countryKey_examKey_trackKey_locale_setKey", [
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
    sectionIdentity: v.string(),
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
    .index("by_status_and_expiresAt", ["status", "expiresAt"]),

  tryoutAttemptPlacements: defineTable({
    answerArtifactHash: v.string(),
    answerContentKey: v.string(),
    placementIdentity: v.string(),
    placementRowHash: v.string(),
    questionArtifactHash: v.string(),
    questionContentKey: v.string(),
    rendererDomain: rendererDomainValidator,
    sectionIdentity: v.string(),
    sectionKey: tryoutRouteKeyValidator,
    tryoutAttemptId: v.id("tryoutAttempts"),
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
    .index("by_tryoutAttemptId_and_sectionKey_and_questionOrder", [
      "tryoutAttemptId",
      "sectionKey",
      "questionOrder",
    ]),

  tryoutResponses: defineTable({
    tryoutAttemptId: v.id("tryoutAttempts"),
    tryoutSectionAttemptId: v.id("tryoutSectionAttempts"),
    placementId: v.id("tryoutAttemptPlacements"),
    selectedOptionId: v.optional(v.string()),
    textAnswer: v.optional(v.string()),
    isCorrect: v.boolean(),
    timeSpent: v.number(),
    answeredAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tryoutSectionAttemptId_and_answeredAt", [
      "tryoutSectionAttemptId",
      "answeredAt",
    ])
    .index("by_tryoutAttemptId_and_answeredAt", [
      "tryoutAttemptId",
      "answeredAt",
    ])
    .index("by_placementId", ["placementId"]),

  tryoutScores: defineTable({
    tryoutAttemptId: v.id("tryoutAttempts"),
    tryoutSnapshotId: v.string(),
    setIdentity: v.string(),
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
    .index("by_userId_and_finalizedAt", ["userId", "finalizedAt"]),
};

export default tables;
