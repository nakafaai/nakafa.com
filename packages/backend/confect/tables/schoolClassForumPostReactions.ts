import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    postId: IdSchema("schoolClassForumPosts"),
    userId: IdSchema("users"),
    emoji: Schema.String,
  })
)
  .index("by_postId_and_userId_and_emoji", ["postId", "userId", "emoji"])
  .index("by_postId_and_emoji_and_userId", ["postId", "emoji", "userId"])
  .index("by_userId", ["userId"]);
