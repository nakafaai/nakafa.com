import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    slug: Schema.String,
    userId: IdSchema("users"),
    text: Schema.String,
    parentId: Schema.optionalKey(IdSchema("comments")),
    replyToUserId: Schema.optionalKey(IdSchema("users")),
    // Denormalized preview of parent comment (stored at reply time, like Discord)
    replyToText: Schema.optionalKey(Schema.String),
    upvoteCount: Schema.Finite,
    downvoteCount: Schema.Finite,
    replyCount: Schema.Finite,
  })
)
  .index("by_slug", ["slug"])
  .index("by_parentId", ["parentId"])
  .index("by_userId", ["userId"])
  .index("by_replyToUserId", ["replyToUserId"]);
