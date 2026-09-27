import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    forumId: IdSchema("schoolClassForums"),
    userId: IdSchema("users"),
    emoji: Schema.String,
  })
)
  .index("by_forumId_and_userId_and_emoji", ["forumId", "userId", "emoji"])
  .index("by_forumId_and_emoji_and_userId", ["forumId", "emoji", "userId"])
  .index("by_userId", ["userId"]);
