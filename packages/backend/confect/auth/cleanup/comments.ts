import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { removeCommentLike } from "@repo/backend/confect/comments/likes";
import { findComment } from "@repo/backend/confect/comments/rows";
import { rootAfterPromotion } from "@repo/backend/confect/comments/thread";
import { COMMENT_LIKE_CLEANUP_BATCH_SIZE } from "@repo/backend/confect/triggers/comments/cleanup";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, flow, Option } from "effect";

const COMMENT_VOTE_BATCH_SIZE = 50;
const COMMENT_REFERENCE_BATCH_SIZE = 25;

/** The placement of a comment that stands at the top of its own thread, with no replies counted yet. */
const TOP_LEVEL = {
  parentId: undefined,
  replyCount: 0,
  replyToText: undefined,
  replyToUserId: undefined,
  threadId: undefined,
};

/**
 * Moves one bounded batch of the members of a thread whose top-level comment is
 * being deleted, after its replies stand as top-level comments, into the thread of
 * the comment each one hangs from, and counts it there. Whether any were moved.
 */
const rethreadMembers = Effect.fn("auth.cleanup.rethreadMembers")(function* (
  threadId: Id<"comments">
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const members = yield* database
    .table("comments")
    .index("by_threadId", (query) => query.eq("threadId", threadId))
    .take(COMMENT_REFERENCE_BATCH_SIZE)
    .pipe(Effect.orDie);
  for (const member of members) {
    const root = yield* rootAfterPromotion(member);
    if (root._id === member._id) {
      yield* writer
        .table("comments")
        .patch(member._id, TOP_LEVEL)
        .pipe(Effect.orDie);
      continue;
    }
    yield* writer
      .table("comments")
      .patch(member._id, { threadId: root._id })
      .pipe(Effect.orDie);
    yield* writer
      .table("comments")
      .patch(root._id, { replyCount: root.replyCount + 1 })
      .pipe(Effect.orDie);
  }
  return members.length > 0;
});

/**
 * Deletes one bounded batch of a user's comments and votes, and keeps every reply
 * other learners wrote. The replies of a deleted top-level comment stand as top-level
 * comments, and the rest of its thread joins the thread of the reply it hangs from.
 * The replies of a deleted reply move up to that reply's parent, in the same thread.
 */
export const cleanupComments = Effect.fn("auth.cleanup.cleanupComments")(
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const votes = yield* database
      .table("commentVotes")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(COMMENT_VOTE_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const vote of votes) {
      yield* writer.table("commentVotes").delete(vote._id);
    }
    if (votes.length > 0) {
      return true;
    }
    const referencedReplies = yield* database
      .table("comments")
      .index("by_replyToUserId", (query) => query.eq("replyToUserId", userId))
      .take(COMMENT_REFERENCE_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const reply of referencedReplies) {
      yield* writer
        .table("comments")
        .patch(reply._id, {
          replyToText: undefined,
          replyToUserId: undefined,
        })
        .pipe(Effect.orDie);
    }
    if (referencedReplies.length > 0) {
      return true;
    }
    const comment = yield* database
      .table("comments")
      .index("by_userId", (query) => query.eq("userId", userId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (!comment) {
      return false;
    }
    const commentVotes = yield* database
      .table("commentVotes")
      .index("by_commentId_and_userId", (query) =>
        query.eq("commentId", comment._id)
      )
      .take(COMMENT_VOTE_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const vote of commentVotes) {
      yield* writer.table("commentVotes").delete(vote._id);
    }
    if (commentVotes.length > 0) {
      return true;
    }
    const replies = yield* database
      .table("comments")
      .index("by_parentId", (query) => query.eq("parentId", comment._id))
      .take(COMMENT_REFERENCE_BATCH_SIZE)
      .pipe(Effect.orDie);
    const parent =
      comment.parentId === undefined
        ? null
        : yield* findComment(comment.parentId);
    for (const reply of replies) {
      yield* writer
        .table("comments")
        .patch(
          reply._id,
          parent === null
            ? TOP_LEVEL
            : {
                parentId: parent._id,
                replyToText: undefined,
                replyToUserId: parent.userId,
              }
        )
        .pipe(Effect.orDie);
    }
    if (replies.length > 0) {
      return true;
    }
    if (parent === null && (yield* rethreadMembers(comment._id))) {
      return true;
    }
    yield* writer.table("comments").delete(comment._id);
    return true;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/**
 * Removes one bounded batch of the learner's own likes on comments, and takes each
 * one off the count of the comment it was on, so the counts of other learners'
 * comments stay exact.
 */
export const cleanupCommentLikes = Effect.fn(
  "auth.cleanup.cleanupCommentLikes"
)(
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const likes = yield* database
      .table("commentLikes")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(COMMENT_LIKE_CLEANUP_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const like of likes) {
      const comment = yield* findComment(like.commentId);
      yield* removeCommentLike(like, comment);
    }
    return likes.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
