import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    slug: Schema.String,
    userId: IdSchema("users"),
    collectionId: Schema.optionalKey(IdSchema("bookmarkCollections")),
    note: Schema.optionalKey(Schema.String),
    order: Schema.Finite,
    bookmarkedAt: Schema.Finite,
    updatedAt: Schema.optionalKey(Schema.Finite),
  })
).index("by_userId", ["userId"]);
