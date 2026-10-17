import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    postId: IdSchema("posts"),
    userId: IdSchema("users"),
  })
)
  .index("by_postId_and_userId", ["postId", "userId"])
  .index("by_userId", ["userId"]);
