import { GenericId, Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { attemptEndReasonValidator } from "@repo/backend/confect/lib/attempts";
import { tryoutAttemptAccessSourceKindValidator } from "@repo/backend/confect/tryouts/access/source";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { tryoutSectionSnapshotValidator } from "@repo/backend/confect/tryouts/runtime/schema";
import {
  tryoutScoreStatusValidator,
  tryoutScoringStrategyValidator,
} from "@repo/backend/confect/tryouts/score";
import { tryoutStatusValidator } from "@repo/backend/confect/tryouts/status";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    userId: IdSchema("users"),
    tryoutBundleId: IdSchema("tryoutRuntimeBundles"),
    tryoutBundleHash: Schema.String,
    tryoutSnapshotId: Schema.String,
    snapshotReleaseId: Schema.String,
    setIdentity: Schema.String,
    /** Frozen localized route used to resume after a later catalog rename. */
    setPublicPath: Schema.String,
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    appLocale: appLocaleValidator,
    scaleVersionId: Schema.optionalKey(IdSchema("irtScaleVersions")),
    accessCampaignId: Schema.optionalKey(
      GenericId.GenericId("tryoutAccessCampaigns")
    ),
    accessGrantId: Schema.optionalKey(
      GenericId.GenericId("tryoutAccessGrants")
    ),
    accessSubscriptionId: Schema.optionalKey(Schema.String),
    accessEndsAt: Schema.Finite,
    accessSourceKind: tryoutAttemptAccessSourceKindValidator,
    countsForCompetition: Schema.Boolean,
    scoreStatus: tryoutScoreStatusValidator,
    scoringStrategy: tryoutScoringStrategyValidator,
    status: tryoutStatusValidator,
    sectionSnapshots: Schema.mutable(
      Schema.Array(tryoutSectionSnapshotValidator)
    ),
    completedSectionKeys: Schema.mutable(Schema.Array(tryoutRouteKeyValidator)),
    attemptNumber: Schema.Finite,
    totalCorrect: Schema.Finite,
    totalQuestions: Schema.Finite,
    theta: Schema.optionalKey(Schema.Finite),
    thetaSE: Schema.optionalKey(Schema.Finite),
    startedAt: Schema.Finite,
    expiresAt: Schema.Finite,
    lastActivityAt: Schema.Finite,
    completedAt: Schema.Union([Schema.Finite, Schema.Null]),
    endReason: Schema.Union([attemptEndReasonValidator, Schema.Null]),
  })
)
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
  .index("by_userId_and_set_and_startedAt", [
    "userId",
    "countryKey",
    "examKey",
    "trackKey",
    "setKey",
    "startedAt",
  ])
  .index("by_userId_and_set_and_attemptNumber", [
    "userId",
    "countryKey",
    "examKey",
    "trackKey",
    "setKey",
    "attemptNumber",
  ])
  .index("by_userId_and_set_and_status", [
    "userId",
    "countryKey",
    "examKey",
    "trackKey",
    "setKey",
    "status",
  ])
  .index("by_setIdentity_and_scoreStatus_and_status_and_startedAt", [
    "setIdentity",
    "scoreStatus",
    "status",
    "startedAt",
  ]);
