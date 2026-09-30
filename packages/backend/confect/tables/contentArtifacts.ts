import { Table } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    artifactHash: Schema.String,
    artifactJson: Schema.String,
    // Rows stored before contentArtifactFacts keep these until the artifact
    // facts backfill moves them; the contract change then removes both fields.
    createdAt: Schema.optionalKey(Schema.Finite),
    retainUntil: Schema.optionalKey(Schema.Finite),
  })
).index("by_artifactHash", ["artifactHash"]);
