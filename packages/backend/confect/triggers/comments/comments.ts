import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Duration, Effect, Struct } from "effect";

/**
 * Trigger handler for comments table changes.
 *
 * Manages comment thread relationships and schedules bounded cleanup:
 * - On insert: Increments parent comment's reply count
 * - On delete: Schedules dependent cleanup, decrements parent count
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export const commentsHandler = Effect.fn(
  "triggers.comments.comments.commentsHandler"
)(function* (change: Change<DataModel, "comments">) {
  const scheduler = yield* Scheduler;
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  if (change.operation === "insert") {
    const comment = change.newDoc;
    if (!comment.parentId) {
      return;
    }
    const parentComment = yield* database
      .table("comments")
      .get(comment.parentId)
      .pipe(Effect.orDie);
    // Confect patch re-reads the whole row before replacing it, so replace
    // the row loaded above with every stored field kept.
    yield* writer
      .table("comments")
      .replace(parentComment._id, {
        ...Struct.omit(parentComment, ["_id", "_creationTime"]),
        replyCount: parentComment.replyCount + 1,
      })
      .pipe(Effect.orDie);
    return;
  }
  if (change.operation !== "delete") {
    return;
  }
  const oldComment = change.oldDoc;
  yield* scheduler.runAfter(
    Duration.millis(0),
    refs.internal.triggers.comments.cleanup.cleanupDeletedComment,
    {
      commentId: change.id,
    }
  );
  if (!oldComment.parentId) {
    return;
  }
  const parentComment = yield* database
    .table("comments")
    .get(oldComment.parentId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!parentComment) {
    return;
  }
  yield* writer
    .table("comments")
    .replace(parentComment._id, {
      ...Struct.omit(parentComment, ["_id", "_creationTime"]),
      replyCount: Math.max(parentComment.replyCount - 1, 0),
    })
    .pipe(Effect.orDie);
});
