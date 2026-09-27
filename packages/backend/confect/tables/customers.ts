import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { polarMetadataValidator } from "@repo/backend/confect/customers/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    /** Polar customer ID persisted for webhook and checkout lookups. */
    id: Schema.String,
    externalId: Schema.NullOr(Schema.String),
    userId: IdSchema("users"),
    metadata: Schema.optionalKey(polarMetadataValidator),
  })
)
  .index("by_userId", ["userId"])
  .index("by_polarId", ["id"]);
