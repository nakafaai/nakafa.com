import type { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type commentLikesTable from "@repo/backend/confect/_generated/tables/commentLikes";
import {
  type CommentDoc,
  findCommentLike,
  likeCountOf,
} from "@repo/backend/confect/comments/rows";
import { COMMENT_LIKE_CLEANUP_BATCH_SIZE } from "@repo/backend/confect/triggers/comments/cleanup";
import { Effect, Struct } from "effect";

/** A like as the database holds it. */
type LikeDoc = typeof commentLikesTable.Doc.Type;

/**
 * Adds a learner's like to a comment and raises its count, in the caller's
 * transaction. A like the learner already left changes nothing.
 */
export const addCommentLike = Effect.fn("comments.likes.addCommentLike")(
  function* (comment: CommentDoc, userId: Id<"users">) {
    const writer = yield* DatabaseWriter;
    const existing = yield* findCommentLike(comment._id, userId);
    if (existing !== null) {
      return;
    }
    yield* writer
      .table("commentLikes")
      .insert({ commentId: comment._id, userId })
      .pipe(Effect.orDie);
    yield* writer
      .table("comments")
      .replace(comment._id, {
        ...Struct.omit(comment, ["_id", "_creationTime"]),
        likeCount: likeCountOf(comment) + 1,
      })
      .pipe(Effect.orDie);
  }
);

/**
 * Removes one like and takes it off the count of its comment, which the caller has
 * read. A comment that is gone takes only its like, so no count is written for it.
 */
export const removeCommentLike = Effect.fn("comments.likes.removeCommentLike")(
  function* (like: LikeDoc, comment: CommentDoc | null) {
    const writer = yield* DatabaseWriter;
    yield* writer.table("commentLikes").delete(like._id);
    if (comment === null) {
      return;
    }
    yield* writer
      .table("comments")
      .replace(comment._id, {
        ...Struct.omit(comment, ["_id", "_creationTime"]),
        likeCount: likeCountOf(comment) - 1,
      })
      .pipe(Effect.orDie);
  }
);

/**
 * Takes a learner's like off a comment and lowers its count. A learner who has not
 * liked the comment changes nothing.
 */
export const takeBackCommentLike = Effect.fn(
  "comments.likes.takeBackCommentLike"
)(function* (comment: CommentDoc, userId: Id<"users">) {
  const like = yield* findCommentLike(comment._id, userId);
  if (like === null) {
    return;
  }
  yield* removeCommentLike(like, comment);
});

/**
 * Removes one bounded batch of the likes of a comment, and returns how many it
 * removed. A comment with more likes than one batch takes several passes.
 */
export const removeCommentLikeBatch = Effect.fn(
  "comments.likes.removeCommentLikeBatch"
)(function* (commentId: Id<"comments">) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const likes = yield* reader
    .table("commentLikes")
    .index("by_commentId_and_userId", (q) => q.eq("commentId", commentId))
    .take(COMMENT_LIKE_CLEANUP_BATCH_SIZE)
    .pipe(Effect.orDie);
  for (const like of likes) {
    yield* writer.table("commentLikes").delete(like._id);
  }
  return likes.length;
});
