import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { rendererDomainValidator } from "@repo/backend/confect/contentRelease/spec";
import { tryoutResponseSpecValidator } from "@repo/backend/confect/tryouts/response/model";
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
    responseSpec: tryoutResponseSpecValidator,
    sourceRevision: Schema.String,
    contentHash: Schema.String,
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
