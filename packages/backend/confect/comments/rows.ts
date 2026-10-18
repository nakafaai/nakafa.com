import type { Id } from "@repo/backend/confect/_generated/id";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type commentsTable from "@repo/backend/confect/_generated/tables/comments";
import { Effect } from "effect";

/** A comment as the database holds it. */
export type CommentDoc = typeof commentsTable.Doc.Type;

/**
 * The likes a comment holds, as its count says. A row written before the likes table
 * has no count until the migration sets one, so it reads as zero until then. The
 * contract stage removes this read, once every row holds its count.
 */
export function likeCountOf(comment: CommentDoc): number {
  return comment.likeCount ?? 0;
}

/** The comment with this id, or null once it is deleted. */
export const findComment = Effect.fn("comments.rows.findComment")(function* (
  commentId: Id<"comments">
) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("comments")
    .get(commentId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** The like a learner left on a comment, or null when they have not liked it. */
export const findCommentLike = Effect.fn("comments.rows.findCommentLike")(
  function* (commentId: Id<"comments">, userId: Id<"users">) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("commentLikes")
      .get("by_commentId_and_userId", commentId, userId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  }
);

/**
 * Whether a learner has liked the comment. A signed-out caller has no id, so it
 * has liked nothing.
 */
export const isCommentLikedBy = Effect.fn("comments.rows.isCommentLikedBy")(
  function* (commentId: Id<"comments">, userId: Id<"users"> | null) {
    if (userId === null) {
      return false;
    }
    const like = yield* findCommentLike(commentId, userId);
    return like !== null;
  }
);
