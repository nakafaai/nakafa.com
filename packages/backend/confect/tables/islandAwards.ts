import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AwardKind } from "@repo/backend/confect/island/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    /** The island's day of the grant, as an ISO date in the island's zone. */
    day: Schema.String,
    /** The one key the granting source holds for good (ADR 0042, D8). */
    key: Schema.String,
    kind: AwardKind,
    /** The Stars granted, at most the kind's and what remained of the day. */
    stars: Schema.Finite,
    /** The material domain of a lesson grant, which subject badges count. */
    subject: Schema.optionalKey(Schema.String),
    userId: IdSchema("users"),
  })
)
  .index("by_userId_and_key", ["userId", "key"])
  .index("by_userId_and_day", ["userId", "day"])
  .index("by_userId_and_kind", ["userId", "kind"])
  .index("by_userId_and_subject", ["userId", "subject"]);
