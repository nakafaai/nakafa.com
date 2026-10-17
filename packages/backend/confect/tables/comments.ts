import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    slug: Schema.String,
    userId: IdSchema("users"),
    text: Schema.String,
    parentId: Schema.optionalKey(IdSchema("comments")),
    // The top-level comment this reply belongs to. A top-level comment has none.
    threadId: Schema.optionalKey(IdSchema("comments")),
    replyToUserId: Schema.optionalKey(IdSchema("users")),
    // Denormalized preview of parent comment, kept on old rows until the contract stage.
    replyToText: Schema.optionalKey(Schema.String),
    // Kept exact by the like mutations. A row written before the likes table has none.
    likeCount: Schema.optionalKey(Schema.Finite),
    upvoteCount: Schema.Finite,
    downvoteCount: Schema.Finite,
    // On a top-level comment, the number of comments in its thread.
    replyCount: Schema.Finite,
  })
)
  .index("by_slug_and_threadId", ["slug", "threadId"])
  .index("by_threadId", ["threadId"])
  .index("by_parentId", ["parentId"])
  .index("by_userId", ["userId"])
  .index("by_replyToUserId", ["replyToUserId"]);
