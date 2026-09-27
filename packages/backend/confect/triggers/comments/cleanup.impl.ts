import {
  DatabaseReader,
  DatabaseWriter,
  FunctionImpl,
  GroupImpl,
  Scheduler,
} from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import {
  COMMENT_REPLY_CLEANUP_BATCH_SIZE,
  COMMENT_VOTE_CLEANUP_BATCH_SIZE,
} from "@repo/backend/confect/triggers/comments/cleanup";
import spec from "@repo/backend/confect/triggers/comments/cleanup.spec";
import { Duration, Effect, Layer } from "effect";

const cleanupDeletedComment = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupDeletedComment",
  Effect.fn("triggers.comments.cleanup.cleanupDeletedComment")(
    function* (args) {
      const ctx = yield* MutationCtxService;
      const scheduler = yield* Scheduler.Scheduler.pipe(
        Effect.provide(Scheduler.layer(ctx.scheduler))
      );
      const database = DatabaseReader.make(databaseSchema, ctx.db);
      const writer = DatabaseWriter.make(databaseSchema, ctx.db);
      const votes = yield* database
        .table("commentVotes")
        .index("by_commentId_and_userId", (q) =>
          q.eq("commentId", args.commentId)
        )
        .take(COMMENT_VOTE_CLEANUP_BATCH_SIZE)
        .pipe(Effect.orDie);
      for (const vote of votes) {
        yield* writer.table("commentVotes").delete(vote._id);
      }
      if (votes.length === COMMENT_VOTE_CLEANUP_BATCH_SIZE) {
        yield* scheduler.runAfter(
          Duration.millis(0),
          refs.internal.triggers.comments.cleanup.cleanupDeletedComment,
          args
        );
        return null;
      }
      const replies = yield* database
        .table("comments")
        .index("by_parentId", (q) => q.eq("parentId", args.commentId))
        .take(COMMENT_REPLY_CLEANUP_BATCH_SIZE)
        .pipe(Effect.orDie);
      for (const reply of replies) {
        yield* writer.table("comments").delete(reply._id);
      }
      if (replies.length < COMMENT_REPLY_CLEANUP_BATCH_SIZE) {
        return null;
      }
      yield* scheduler.runAfter(
        Duration.millis(0),
        refs.internal.triggers.comments.cleanup.cleanupDeletedComment,
        args
      );
      return null;
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(cleanupDeletedComment),
  Layer.provide(atomic),
  GroupImpl.finalize
);
