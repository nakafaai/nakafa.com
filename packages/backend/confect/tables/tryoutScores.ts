import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  tryoutScoreStatusValidator,
  tryoutScoringStrategyValidator,
} from "@repo/backend/confect/tryouts/score";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    tryoutAttemptId: IdSchema("tryoutAttempts"),
    tryoutSnapshotId: Schema.String,
    setIdentity: Schema.String,
    userId: IdSchema("users"),
    scoringStrategy: tryoutScoringStrategyValidator,
    scoreStatus: tryoutScoreStatusValidator,
    scaleVersionId: Schema.optionalKey(IdSchema("irtScaleVersions")),
    rawScore: Schema.Finite,
    totalCorrect: Schema.Finite,
    totalQuestions: Schema.Finite,
    theta: Schema.optionalKey(Schema.Finite),
    thetaSE: Schema.optionalKey(Schema.Finite),
    publishedScore: Schema.Finite,
    finalizedAt: Schema.Finite,
  })
)
  .index("by_scaleVersionId", ["scaleVersionId"])
  .index("by_tryoutAttemptId", ["tryoutAttemptId"])
  .index("by_userId_and_finalizedAt", ["userId", "finalizedAt"]);
