import { Table } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    artifactHash: Schema.String,
    artifactJson: Schema.String,
  })
).index("by_artifactHash", ["artifactHash"]);
