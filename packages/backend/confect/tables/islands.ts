import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { EarnedBadge } from "@repo/backend/confect/island/schema";
import { Edits } from "@repo/backend/confect/island/world";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    /** The badges the island earned, at most one of each (ADR 0042, D11). */
    badges: Schema.Array(EarnedBadge),
    /** The island's day of its newest grant, as an ISO date; none before the first. */
    learned: Schema.optionalKey(Schema.String),
    /** Every Star ever granted; the level and the footprint derive from it (ADR 0042, D3). */
    lifetime: Schema.Finite,
    /** The days in a row the learner learned, up to `learned`; none before the first grant. */
    streak: Schema.optionalKey(Schema.Int),
    /** The owner's zone, kept current by their own visits; it sets the island's day. */
    timeZone: Schema.TimeZoneNamedFromString,
    userId: IdSchema("users"),
    /** Rises by one on every build, so an edit made against older edits is refused (ADR 0047, D6). */
    version: Schema.Finite,
    /** The cells the learner changed over the generated terrain, packed (ADR 0047, D6). */
    world: Edits,
  })
).index("by_userId", ["userId"]);
