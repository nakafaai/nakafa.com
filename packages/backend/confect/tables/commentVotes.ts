import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { commentVoteValidator } from "@repo/backend/confect/comments/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    commentId: IdSchema("comments"),
    userId: IdSchema("users"),
    vote: commentVoteValidator,
  })
)
  .index("by_commentId_and_userId", ["commentId", "userId"])
  .index("by_userId", ["userId"]);
