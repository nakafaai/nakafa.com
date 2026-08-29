import {
  appLocaleValidator,
  rendererDomainValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { attemptEndReasonValidator } from "@repo/backend/convex/lib/attempts";
import { tryoutAttemptAccessSourceKindValidator } from "@repo/backend/convex/tryouts/access/source";
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

/** Permanent signed snapshot and renderer bundles used by try-out attempts. */
export const tryoutRuntimeBundleSchema = {
  tryoutRuntimeBundles: defineTable({
    bundleHash: v.string(),
    bundleJson: v.string(),
    /** Mutable cleanup owner, absent only after explicit snapshot handoff. */
    cleanupReleaseId: v.optional(v.string()),
    createdAt: v.number(),
    rendererJson: v.string(),
    rendererManifestHash: v.string(),
    snapshotId: v.string(),
    sourceGitSha: v.string(),
    sourceManifestHash: v.string(),
    sourceReleaseId: v.string(),
  })
    .index("by_bundleHash", ["bundleHash"])
    .index("by_cleanupReleaseId", ["cleanupReleaseId"])
    .index("by_sourceReleaseId", ["sourceReleaseId"])
    .index("by_snapshotId_and_rendererManifestHash", [
      "snapshotId",
      "rendererManifestHash",
    ]),
};

const tables = {
  ...tryoutRuntimeBundleSchema,
  tryoutAttempts: defineTable({
    userId: v.id("users"),
    tryoutBundleId: v.id("tryoutRuntimeBundles"),
    tryoutBundleHash: v.string(),
    tryoutSnapshotId: v.string(),
    snapshotReleaseId: v.string(),
    setIdentity: v.string(),
    /** Frozen localized route used to resume after a later catalog rename. */
    setPublicPath: v.string(),
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    appLocale: appLocaleValidator,
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
    .index("by_scaleVersionId", ["scaleVersionId"])
    .index("by_status_and_expiresAt", ["status", "expiresAt"])
    .index("by_tryoutBundleId", ["tryoutBundleId"])
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
    appLocale: appLocaleValidator,
    attemptNumber: v.number(),
    publishedScore: v.union(v.number(), v.null()),
    status: tryoutStatusValidator,
    statusRank: tryoutStatusRankValidator,
    updatedAt: v.number(),
  })
    .index("by_userId_and_setIdentity", ["userId", "setIdentity"])
    .index("by_userId_countryKey_examKey_trackKey_appLocale_setKey", [
      "userId",
      "countryKey",
      "examKey",
      "trackKey",
      "appLocale",
      "setKey",
    ])
    .index("by_userId_and_track_and_publishedScore_and_setKey", [
      "userId",
      "countryKey",
      "examKey",
      "trackKey",
      "appLocale",
      "publishedScore",
      "setKey",
    ])
    .index("by_userId_and_track_and_statusRank_and_setKey", [
      "userId",
      "countryKey",
      "examKey",
      "trackKey",
      "appLocale",
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
    .index("by_scaleVersionId", ["scaleVersionId"])
    .index("by_tryoutAttemptId", ["tryoutAttemptId"])
    .index("by_userId_and_finalizedAt", ["userId", "finalizedAt"]),
};

export default tables;
