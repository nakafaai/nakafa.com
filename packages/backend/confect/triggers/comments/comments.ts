import triggersInternal from "@repo/backend/confect/_generated/refs/triggers.server";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { deleteFile } from "@repo/backend/confect/bucket/file";
import { photoFiles } from "@repo/backend/confect/comments/photo";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Duration, Effect, Number as Num, Struct } from "effect";

/**
 * Moves the count of a slug's comments by one comment. A slug's first comment writes its row, and a
 * count never goes below zero.
 */
const countSlug = Effect.fn("triggers.comments.countSlug")(function* (
  slug: string,
  delta: 1 | -1
) {
  const row = yield* (yield* DatabaseReader)
    .table("commentCounts")
    .get("by_slug", slug)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  const writer = (yield* DatabaseWriter).table("commentCounts");
  if (row === null) {
    if (delta > 0) {
      yield* writer.insert({ count: 1, slug }).pipe(Effect.orDie);
    }
    return;
  }
  yield* writer
    .replace(row._id, { count: Num.max(row.count + delta, 0), slug })
    .pipe(Effect.orDie);
});

/** Moves the reply count of a thread's top-level comment by one reply, once that comment still stands. */
const countThread = Effect.fn("triggers.comments.countThread")(function* (
  threadId: Change<DataModel, "comments">["id"],
  delta: 1 | -1
) {
  const thread = yield* (yield* DatabaseReader)
    .table("comments")
    .get(threadId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (thread === null) {
    return;
  }
  // Confect patch re-reads the whole row before replacing it, so replace
  // the row loaded above with every stored field kept.
  yield* (yield* DatabaseWriter)
    .table("comments")
    .replace(thread._id, {
      ...Struct.omit(thread, ["_id", "_creationTime"]),
      replyCount: Num.max(thread.replyCount + delta, 0),
    })
    .pipe(Effect.orDie);
});

/**
 * Trigger handler for comments table changes. It keeps the count of each slug and of each thread, and
 * clears what a deleted comment leaves behind:
 * - On insert: counts the comment on its slug, and a reply in its thread
 * - On delete: takes the comment off those counts, deletes its photos, and schedules the bounded
 *   cleanup of its likes, reports and replies
 *
 * @param change - The change object containing operation details and document state
 */
export const commentsHandler = Effect.fn(
  "triggers.comments.comments.commentsHandler"
)(function* (change: Change<DataModel, "comments">) {
  if (change.operation === "insert") {
    yield* countSlug(change.newDoc.slug, 1);
    if (change.newDoc.threadId !== undefined) {
      yield* countThread(change.newDoc.threadId, 1);
    }
    return;
  }
  if (change.operation !== "delete") {
    return;
  }
  const oldComment = change.oldDoc;
  yield* (yield* Scheduler).runAfter(
    Duration.millis(0),
    triggersInternal.comments.cleanup.cleanupDeletedComment,
    { commentId: change.id }
  );
  yield* countSlug(oldComment.slug, -1);
  yield* Effect.forEach(photoFiles(oldComment.photos), deleteFile);
  if (oldComment.threadId !== undefined) {
    yield* countThread(oldComment.threadId, -1);
  }
});
