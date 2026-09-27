import { Table } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    attemptId: Schema.String,
    canceledAt: Schema.Finite,
  })
)
  .index("by_attemptId", ["attemptId"])
  .index("by_canceledAt", ["canceledAt"]);
