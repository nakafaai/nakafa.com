import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Sticker } from "@repo/backend/confect/island/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    /** When the visitor left the sticker, in epoch milliseconds. */
    at: Schema.Finite,
    sticker: Sticker,
    /** The owner of the world whose guest book holds the row (ADR 0050, W6). */
    userId: IdSchema("users"),
    /** The visitor, who holds one row in each world: a second sticker replaces the first. */
    visitorId: IdSchema("users"),
  })
)
  /** The owner reads the newest guests first. */
  .index("by_userId_and_at", ["userId", "at"])
  .index("by_userId_and_visitorId", ["userId", "visitorId"])
  /** A deleted account takes the stickers it left with it. */
  .index("by_visitorId", ["visitorId"]);
