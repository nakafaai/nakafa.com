import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AwardKind } from "@repo/backend/confect/progress/schema";
import { Schema } from "effect";

export default Table.make(() =>
  Schema.Struct({
    /** The day of the grant, as an ISO date in the learner's time zone. */
    day: Schema.String,
    /** The one key the granting source holds for good, so the same learning never grants twice. */
    key: Schema.String,
    kind: AwardKind,
    /** The Stars granted, at most the kind's Stars and what remained of the day's cap. */
    stars: Schema.Finite,
    /** The material domain of a lesson grant, the record of what the learner's tally counted. */
    subject: Schema.optionalKey(Schema.String),
    userId: IdSchema("users"),
  })
)
  .index("by_userId_and_key", ["userId", "key"])
  .index("by_userId_and_day", ["userId", "day"]);
