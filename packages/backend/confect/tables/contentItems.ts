import { Table } from "@confect/core";
import { artifactLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    artifactHash: Schema.optionalKey(Schema.String),
    artifactLocale: artifactLocaleValidator,
    artifactBatchHash: Schema.optionalKey(Schema.String),
    artifactBatchIndex: Schema.optionalKey(Schema.Finite),
    artifactReady: Schema.Boolean,
    contentKey: Schema.String,
    index: Schema.Finite,
    itemBatchHash: Schema.String,
    itemBatchIndex: Schema.Finite,
    itemJson: Schema.String,
    priorSequence: Schema.optionalKey(Schema.Finite),
    projectionBatchHash: Schema.optionalKey(Schema.String),
    projectionBatchIndex: Schema.optionalKey(Schema.Finite),
    projectionJson: Schema.optionalKey(Schema.String),
    projectionReady: Schema.Boolean,
    releaseId: Schema.String,
    rollbackJson: Schema.String,
    sequence: Schema.Finite,
    stagedAt: Schema.Finite,
  })
)
  .index("by_releaseId_and_index", ["releaseId", "index"])
  .index("by_releaseId_and_contentKey_and_artifactLocale", [
    "releaseId",
    "contentKey",
    "artifactLocale",
  ])
  .index("by_releaseId_and_itemBatchIndex", ["releaseId", "itemBatchIndex"])
  .index("by_releaseId_and_artifactBatchIndex", [
    "releaseId",
    "artifactBatchIndex",
  ])
  .index("by_releaseId_and_projectionBatchIndex", [
    "releaseId",
    "projectionBatchIndex",
  ])
  .index("by_artifactHash", ["artifactHash"])
  .index("by_sequence", ["sequence"]);
