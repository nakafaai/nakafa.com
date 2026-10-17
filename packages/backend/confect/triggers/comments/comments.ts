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
 * Keeps the reply count of each thread and schedules bounded cleanup:
 * - On insert of a reply: increments the count of its thread's top-level comment
 * - On delete: schedules the cleanup of the deleted comment, and decrements the
 *   count of its thread when it is a reply
 *
 * @param change - The change object containing operation details and document state
 */
export const commentsHandler = Effect.fn(
  "triggers.comments.comments.commentsHandler"
)(function* (change: Change<DataModel, "comments">) {
  const scheduler = yield* Scheduler;
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  if (change.operation === "insert") {
    const threadId = change.newDoc.threadId;
    if (threadId === undefined) {
      return;
    }
    const thread = yield* database
      .table("comments")
      .get(threadId)
      .pipe(Effect.orDie);
    // Confect patch re-reads the whole row before replacing it, so replace
    // the row loaded above with every stored field kept.
    yield* writer
      .table("comments")
      .replace(thread._id, {
        ...Struct.omit(thread, ["_id", "_creationTime"]),
        replyCount: thread.replyCount + 1,
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
  if (oldComment.threadId === undefined) {
    return;
  }
  const thread = yield* database
    .table("comments")
    .get(oldComment.threadId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!thread) {
    return;
  }
  yield* writer
    .table("comments")
    .replace(thread._id, {
      ...Struct.omit(thread, ["_id", "_creationTime"]),
      replyCount: Math.max(thread.replyCount - 1, 0),
    })
    .pipe(Effect.orDie);
});
