import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { removeCommentLikeBatch } from "@repo/backend/confect/comments/likes";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import {
  COMMENT_LIKE_CLEANUP_BATCH_SIZE,
  COMMENT_REPLY_CLEANUP_BATCH_SIZE,
} from "@repo/backend/confect/triggers/comments/cleanup";
import spec from "@repo/backend/confect/triggers/comments/cleanup.spec";
import { Duration, Effect, Layer } from "effect";

/** Schedules the next pass over one deleted comment, which runs after this pass commits. */
const scheduleNextPass = Effect.fn(
  "triggers.comments.cleanup.scheduleNextPass"
)(function* (commentId: Id<"comments">) {
  const scheduler = yield* Scheduler;
  yield* scheduler.runAfter(
    Duration.millis(0),
    refs.internal.triggers.comments.cleanup.cleanupDeletedComment,
    { commentId }
  );
  return null;
});

/**
 * Removes what a deleted comment leaves behind, one bounded batch at a time: its
 * likes, then its replies. A deleted top-level comment takes its whole thread, every
 * reply at any depth. A deleted reply takes the replies that name it as their parent,
 * and each of those takes its own. A batch that fills up schedules the next pass.
 */
const cleanupDeletedComment = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupDeletedComment",
  Effect.fn("triggers.comments.cleanup.cleanupDeletedComment")(
    function* (args) {
      const database = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const removedLikes = yield* removeCommentLikeBatch(args.commentId);
      if (removedLikes === COMMENT_LIKE_CLEANUP_BATCH_SIZE) {
        return yield* scheduleNextPass(args.commentId);
      }
      const members = yield* database
        .table("comments")
        .index("by_threadId", (q) => q.eq("threadId", args.commentId))
        .take(COMMENT_REPLY_CLEANUP_BATCH_SIZE)
        .pipe(Effect.orDie);
      for (const member of members) {
        yield* writer.table("comments").delete(member._id);
      }
      if (members.length === COMMENT_REPLY_CLEANUP_BATCH_SIZE) {
        return yield* scheduleNextPass(args.commentId);
      }
      const replies = yield* database
        .table("comments")
        .index("by_parentId", (q) => q.eq("parentId", args.commentId))
        .take(COMMENT_REPLY_CLEANUP_BATCH_SIZE)
        .pipe(Effect.orDie);
      for (const reply of replies) {
        yield* writer.table("comments").delete(reply._id);
      }
      if (replies.length === COMMENT_REPLY_CLEANUP_BATCH_SIZE) {
        return yield* scheduleNextPass(args.commentId);
      }
      return null;
    }
  )
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(cleanupDeletedComment),
  Layer.provide(atomic),
  GroupImpl.finalize
);
