import { Ref } from "@confect/core";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Effect } from "effect";

const COMMENT_VOTE_CLEANUP_BATCH_SIZE = 100;
const COMMENT_REPLY_CLEANUP_BATCH_SIZE = 100;

/** Schedules another deleted-comment cleanup batch. */
function rescheduleDeletedComment(
  ctx: MutationCtx,
  args: { commentId: Id<"comments"> }
) {
  return ctx.scheduler.runAfter(
    0,
    Ref.getFunctionReference(
      refs.internal.triggers.comments.cleanup.cleanupDeletedComment
    ),
    args
  );
}

/** Removes votes and replies after a comment row has been deleted. */
export const cleanupDeletedComment = Effect.fn(
  "commentCleanup.cleanupDeletedComment"
)(function* (args: { commentId: Id<"comments"> }) {
  const ctx = yield* MutationCtx;
  const votes = yield* Effect.promise(() =>
    ctx.db
      .query("commentVotes")
      .withIndex("by_commentId_and_userId", (query) =>
        query.eq("commentId", args.commentId)
      )
      .take(COMMENT_VOTE_CLEANUP_BATCH_SIZE)
  );

  for (const vote of votes) {
    yield* Effect.promise(() => ctx.db.delete(vote._id));
  }

  if (votes.length === COMMENT_VOTE_CLEANUP_BATCH_SIZE) {
    yield* Effect.promise(() => rescheduleDeletedComment(ctx, args));
    return null;
  }

  const replies = yield* Effect.promise(() =>
    ctx.db
      .query("comments")
      .withIndex("by_parentId", (query) => query.eq("parentId", args.commentId))
      .take(COMMENT_REPLY_CLEANUP_BATCH_SIZE)
  );

  for (const reply of replies) {
    yield* Effect.promise(() => ctx.db.delete(reply._id));
  }

  if (replies.length === COMMENT_REPLY_CLEANUP_BATCH_SIZE) {
    yield* Effect.promise(() => rescheduleDeletedComment(ctx, args));
  }

  return null;
});
