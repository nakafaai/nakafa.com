import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Tally } from "@repo/backend/confect/island/schema";
import { Edits } from "@repo/backend/confect/island/world";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    /** The island's day of its newest grant, as an ISO date; none before the first. */
    learned: Schema.optionalKey(Schema.String),
    /** Every Star ever granted; the level and the footprint derive from it (ADR 0042, D3). */
    lifetime: Schema.Finite,
    /** The days in a row the learner learned, up to `learned`; none before the first grant. */
    streak: Schema.optionalKey(Schema.Int),
    /** What the island counted of its owner's learning; every badge derives from it (ADR 0047, D30). */
    tally: Tally,
    /** The owner's zone, kept current by their own visits; it sets the island's day. */
    timeZone: Schema.TimeZoneNamedFromString,
    userId: IdSchema("users"),
    /** Rises by one on every build, so an edit made against older edits is refused (ADR 0047, D6). */
    version: Schema.Finite,
    /** The cells the learner changed over the generated terrain, packed (ADR 0047, D6). */
    world: Edits,
  })
)
  .index("by_userId", ["userId"])
  /** The global leaderboard reads the islands with the most Stars first (ADR 0047, D27). */
  .index("by_lifetime", ["lifetime"]);
