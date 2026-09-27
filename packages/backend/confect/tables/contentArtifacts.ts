import { Table } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    artifactHash: Schema.String,
    artifactJson: Schema.String,
    createdAt: Schema.Finite,
    retainUntil: Schema.Finite,
  })
)
  .index("by_artifactHash", ["artifactHash"])
  .index("by_retainUntil_and_artifactHash", ["retainUntil", "artifactHash"]);
