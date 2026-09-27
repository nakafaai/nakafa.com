import { Table } from "@confect/core";
import {
  artifactLocaleValidator,
  contentFamilyValidator,
  deliveryValidator,
  headOperationValidator,
  rendererDomainValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    artifactHash: Schema.optionalKey(Schema.String),
    artifactLocale: artifactLocaleValidator,
    compilerConfigHash: Schema.optionalKey(Schema.String),
    contentKey: Schema.String,
    delivery: Schema.optionalKey(deliveryValidator),
    family: contentFamilyValidator,
    index: Schema.Finite,
    operation: headOperationValidator,
    projectionHash: Schema.optionalKey(Schema.String),
    projectionJson: Schema.optionalKey(Schema.String),
    releaseId: Schema.String,
    rendererDomain: Schema.optionalKey(rendererDomainValidator),
    sequence: Schema.Finite,
    sourceHash: Schema.optionalKey(Schema.String),
    sourcePath: Schema.optionalKey(Schema.String),
  })
)
  .index("by_contentKey_and_artifactLocale_and_sequence", [
    "contentKey",
    "artifactLocale",
    "sequence",
  ])
  .index("by_releaseId_and_index", ["releaseId", "index"])
  .index("by_releaseId_and_contentKey_and_artifactLocale", [
    "releaseId",
    "contentKey",
    "artifactLocale",
  ])
  .index("by_artifactHash_and_sequence", ["artifactHash", "sequence"])
  .index("by_sequence", ["sequence"]);
