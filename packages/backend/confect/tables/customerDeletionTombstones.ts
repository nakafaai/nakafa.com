import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    /**
     * Polar customer deletion is terminal for this ID. Retaining the ID keeps
     * delayed or replayed webhooks from recreating billing state.
     */
    polarCustomerId: Schema.String,
    /**
     * Present only while the deleted-user billing workflow still needs the
     * Polar ID as a durable retry checkpoint.
     */
    cleanupUserId: Schema.optionalKey(IdSchema("users")),
  })
)
  .index("by_polarCustomerId", ["polarCustomerId"])
  .index("by_cleanupUserId", ["cleanupUserId"]);
