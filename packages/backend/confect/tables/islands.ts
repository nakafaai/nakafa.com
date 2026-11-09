import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Layout } from "@repo/backend/confect/island/layout";
import { Materials } from "@repo/backend/confect/island/material";
import { EarnedBadge, Visibility } from "@repo/backend/confect/island/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    /** The badges the island earned, at most one of each (ADR 0042, D11). */
    badges: Schema.Array(EarnedBadge),
    /** Every material its harvests ever gave (D13). */
    harvested: Materials,
    /** The island's day of its newest grant, as an ISO date; none before the first (D13). */
    learned: Schema.optionalKey(Schema.String),
    /** Every Star ever granted; level and spendable Stars derive from it (D3). */
    lifetime: Schema.Finite,
    /** The placements, stored packed (D4). */
    layout: Layout,
    /** The stored picture of the island its owner last shared, a visit's OpenGraph image; none before the first (D20). */
    snapshot: Schema.optionalKey(IdSchema("bucketFiles")),
    /** The owner's zone, kept current by their own visits; it sets the island's day and hour (D18). */
    timeZone: Schema.TimeZoneNamedFromString,
    userId: IdSchema("users"),
    /** Rises by one on every write of the layout, so an edit of an older layout is refused (D4). */
    version: Schema.Finite,
    visibility: Visibility,
    /** The island's last day of watering, as an ISO date in its zone, none before the first (D13). */
    watered: Schema.optionalKey(Schema.String),
  })
).index("by_userId", ["userId"]);
