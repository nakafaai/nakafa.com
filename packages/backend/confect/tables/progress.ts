import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Tally } from "@repo/backend/confect/progress/schema";
import { Schema } from "effect";

export default Table.make(() =>
  Schema.Struct({
    /** The learner's day of their newest grant, as an ISO date; none before the first. */
    learned: Schema.optionalKey(Schema.String),
    /** Every Star ever granted; the learner's level derives from it. */
    lifetime: Schema.Finite,
    /** The days in a row the learner learned, up to `learned`; none before the first grant. */
    streak: Schema.optionalKey(Schema.Int),
    /** What Nakafa counted of the learner's learning; every badge derives from it. */
    tally: Tally,
    /** The learner's time zone; it sets the day boundary for daily caps and streaks. */
    timeZone: Schema.TimeZoneNamedFromString,
    userId: IdSchema("users"),
  })
)
  .index("by_userId", ["userId"])
  /** The global leaderboard reads the learners with the most Stars first. */
  .index("by_lifetime", ["lifetime"]);
