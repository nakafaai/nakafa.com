import { Table } from "@confect/core";
import { AuthoredQuestionPointsSchema } from "@nakafa/aksara-contracts/question/points";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Version } from "@repo/backend/confect/assessment/gate/rules";
import { rendererDomainValidator } from "@repo/backend/confect/contentRelease/spec";
import { ResponseSpec } from "@repo/backend/confect/response/model";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    answerArtifactHash: Schema.String,
    answerContentKey: Schema.String,
    placementIdentity: Schema.String,
    placementRowHash: Schema.String,
    questionArtifactHash: Schema.String,
    questionContentKey: Schema.String,
    rendererDomain: rendererDomainValidator,
    sectionIdentity: Schema.String,
    sectionKey: tryoutRouteKeyValidator,
    tryoutAttemptId: IdSchema("tryoutAttempts"),
    questionOrder: Schema.Finite,
    sourcePath: Schema.String,
    responseSpec: ResponseSpec,
    /** Authored worth above the default single point; read through `questionPoints`. */
    points: Schema.optionalKey(AuthoredQuestionPointsSchema),
    sourceRevision: Schema.String,
    contentHash: Schema.String,
    /**
     * The version of the write that cleared the question's answer. Deleting the
     * answer deletes the version it carried, so the placement keeps the number
     * that the next write of the question must exceed.
     */
    clearedVersion: Schema.optionalKey(Version),
  })
)
  .index("by_tryoutAttemptId_and_questionOrder", [
    "tryoutAttemptId",
    "questionOrder",
  ])
  .index("by_tryoutAttemptId_and_sectionKey_and_questionOrder", [
    "tryoutAttemptId",
    "sectionKey",
    "questionOrder",
  ]);
