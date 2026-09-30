import { GenericId, Table } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    artifactHash: Schema.String,
    artifactId: GenericId.GenericId("contentArtifacts"),
    artifactJsonHash: Schema.String,
    retainUntil: Schema.Finite,
  })
)
  .index("by_artifactHash", ["artifactHash"])
  .index("by_retainUntil_and_artifactHash", ["retainUntil", "artifactHash"]);
