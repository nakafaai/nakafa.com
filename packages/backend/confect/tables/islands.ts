import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Access, Tally } from "@repo/backend/confect/island/schema";
import { Thing } from "@repo/backend/confect/island/things";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    /** Who the world opens to beside its owner; absent means by link (ADR 0050, W6). */
    access: Schema.optionalKey(Access),
    /** The priced things whose blueprints the learner opened; absent means none (ADR 0050, W5). */
    blueprints: Schema.optionalKey(Schema.Array(Thing)),
    /** How many chunk rows the world holds; absent means none (ADR 0050, W3). */
    chunks: Schema.optionalKey(Schema.Int),
    /** When the owner last entered, in epoch milliseconds; absent before the first. */
    entered: Schema.optionalKey(Schema.Finite),
    /** The island's day of its newest grant, as an ISO date; none before the first. */
    learned: Schema.optionalKey(Schema.String),
    /** Every Star ever granted; the level and the balance derive from it (ADR 0042, D3). */
    lifetime: Schema.Finite,
    /** The days in a row the learner learned, up to `learned`; none before the first grant. */
    streak: Schema.optionalKey(Schema.Int),
    /** What the island counted of its owner's learning; every badge derives from it (ADR 0047, D30). */
    tally: Tally,
    /** The owner's zone, kept current by their own visits; it sets the island's day. */
    timeZone: Schema.TimeZoneNamedFromString,
    userId: IdSchema("users"),
    /**
     * Retired with the world of blocks (ADR 0050): unread, and held only until
     * the Convex CLI clears it from every row after this release, because
     * Convex refuses a schema that drops a field every row holds.
     */
    version: Schema.optionalKey(Schema.Finite),
    /** Retired with the world of blocks (ADR 0050), as `version` is. */
    world: Schema.optionalKey(Schema.instanceOf(ArrayBuffer)),
  })
)
  .index("by_userId", ["userId"])
  /** The global leaderboard reads the islands with the most Stars first (ADR 0047, D27). */
  .index("by_lifetime", ["lifetime"]);
