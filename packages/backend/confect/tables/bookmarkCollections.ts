import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    name: Schema.String,
    description: Schema.optionalKey(Schema.String),
    userId: IdSchema("users"),
    bookmarkCount: Schema.Finite,
    isDefault: Schema.Boolean,
    isPublic: Schema.Boolean,
    emoji: Schema.optionalKey(Schema.String),
    image: Schema.String,
    // auto random pick from a list of images as default
    order: Schema.Finite,
    updatedAt: Schema.Finite,
  })
).index("by_userId", ["userId"]);
