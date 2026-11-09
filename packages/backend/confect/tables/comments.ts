import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { CommentPhotos } from "@repo/backend/confect/comments/photo";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    slug: Schema.String,
    userId: IdSchema("users"),
    // The learner's Markdown, which the page draws as learner text. It may be empty when the comment carries photos.
    text: Schema.String,
    photos: Schema.optionalKey(CommentPhotos),
    // When the author last changed the text. A comment that was never edited has none.
    editedAt: Schema.optionalKey(Schema.Finite),
    parentId: Schema.optionalKey(IdSchema("comments")),
    // The top-level comment this reply belongs to. A top-level comment has none.
    threadId: Schema.optionalKey(IdSchema("comments")),
    replyToUserId: Schema.optionalKey(IdSchema("users")),
    // Kept exact by the like mutations.
    likeCount: Schema.Finite,
    // On a top-level comment, the number of comments in its thread.
    replyCount: Schema.Finite,
  })
)
  .index("by_slug_and_threadId", ["slug", "threadId"])
  // The Top order of a page's comments: the most liked first, the newest first among equals.
  .index("by_slug_and_threadId_and_likeCount", [
    "slug",
    "threadId",
    "likeCount",
  ])
  .index("by_threadId", ["threadId"])
  .index("by_parentId", ["parentId"])
  .index("by_userId", ["userId"])
  .index("by_replyToUserId", ["replyToUserId"]);
