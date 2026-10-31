import { Table } from "@confect/core";
import {
  ExamProfileIdSchema,
  PaperIdSchema,
} from "@nakafa/aksara-contracts/assessment/identity";
import { ScoringStrategySchema } from "@nakafa/aksara-contracts/assessment/scoring";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { EndReason } from "@repo/backend/confect/assessment/gate/end";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { tryoutAttemptAccessSourceKindValidator } from "@repo/backend/confect/tryouts/access/source";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { tryoutSectionValidator } from "@repo/backend/confect/tryouts/runtime/schema";
import { tryoutScoreStatusValidator } from "@repo/backend/confect/tryouts/score";
import { tryoutStatusValidator } from "@repo/backend/confect/tryouts/status";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    userId: IdSchema("users"),
    /** The assessment snapshot the attempt was started from, which retention keeps while the attempt names it. */
    assessmentSnapshotId: Schema.String,
    releaseId: Schema.String,
    /** The paper the learner sits and the profile it follows, by identifier and hash, as the set named them. */
    paper: Schema.Struct({ hash: Sha256HashSchema, id: PaperIdSchema }),
    profile: Schema.Struct({ hash: Sha256HashSchema, id: ExamProfileIdSchema }),
    setIdentity: Schema.String,
    /** Frozen localized route used to resume after a later catalog rename. */
    setPublicPath: Schema.String,
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    appLocale: appLocaleValidator,
    scaleVersionId: Schema.optionalKey(IdSchema("irtScaleVersions")),
    accessSubscriptionId: Schema.optionalKey(Schema.String),
    accessEndsAt: Schema.Finite,
    accessSourceKind: tryoutAttemptAccessSourceKindValidator,
    countsForCompetition: Schema.Boolean,
    scoreStatus: tryoutScoreStatusValidator,
    /** The profile's strategy, frozen with its marks or formula, so a later profile never rescores the attempt. */
    scoring: ScoringStrategySchema,
    status: tryoutStatusValidator,
    /** The set's sections in order, frozen from its catalog rows, its paper, and its profile. */
    sections: Schema.mutable(Schema.Array(tryoutSectionValidator)),
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
    endReason: Schema.Union([EndReason, Schema.Null]),
  })
)
  .index("by_status_and_expiresAt", ["status", "expiresAt"])
  .index("by_assessmentSnapshotId", ["assessmentSnapshotId"])
  .index("by_userId_and_startedAt", ["userId", "startedAt"])
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
  ]);
