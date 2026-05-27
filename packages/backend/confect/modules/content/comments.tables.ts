import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import { Schema } from "effect";

/** Vote values persisted for comment reactions. */
export const commentVoteSchema = Schema.Literal(-1, 1);

/** User-authored comments attached to content slugs. */
export const Comments = Table.make(
  "comments",
  Schema.Struct({
    slug: Schema.String,
    userId: GenericId.GenericId("users"),
    text: Schema.String,
    parentId: Schema.optional(GenericId.GenericId("comments")),
    replyToUserId: Schema.optional(GenericId.GenericId("users")),
    replyToText: Schema.optional(Schema.String),
    upvoteCount: Schema.Number,
    downvoteCount: Schema.Number,
    replyCount: Schema.Number,
  })
)
  .index("by_slug", ["slug"])
  .index("by_parentId", ["parentId"])
  .index("by_userId", ["userId"]);

/** One persisted vote per user and comment. */
export const CommentVotes = Table.make(
  "commentVotes",
  Schema.Struct({
    commentId: GenericId.GenericId("comments"),
    userId: GenericId.GenericId("users"),
    vote: commentVoteSchema,
  })
).index("by_commentId_and_userId", ["commentId", "userId"]);

/** Tables owned by the content comments module. */
export const tables = [Comments, CommentVotes] as const;
