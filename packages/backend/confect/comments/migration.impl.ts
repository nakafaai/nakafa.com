import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/comments/migration.spec";
import type { CommentDoc } from "@repo/backend/confect/comments/rows";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Array as Arr, Duration, Effect, Layer, Struct } from "effect";

/** How many vote rows, and how many comments, one call reads. */
const MIGRATION_BATCH = 50;

/** Whether a comment still holds one of the fields that the strip pass removes. */
function holdsLegacyField(comment: CommentDoc) {
  return (
    comment.upvoteCount !== undefined ||
    comment.downvoteCount !== undefined ||
    comment.replyToText !== undefined
  );
}

/** Schedules the next call of the pass with this cursor, or with none for the first page. */
const scheduleRun = Effect.fn("comments.migration.scheduleRun")(function* (
  cursor: string | undefined
) {
  const scheduler = yield* Scheduler;
  yield* scheduler.runAfter(
    Duration.millis(0),
    refs.internal.comments.migration.run,
    cursor === undefined ? {} : { cursor }
  );
});

/** Deletes the first batch of vote rows, in creation order, and returns how many it deleted. */
const deleteVoteBatch = Effect.fn("comments.migration.deleteVoteBatch")(
  function* () {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const votes = yield* reader
      .table("commentVotes")
      .index("by_creation_time")
      .take(MIGRATION_BATCH)
      .pipe(Effect.orDie);
    for (const vote of votes) {
      yield* writer.table("commentVotes").delete(vote._id);
    }
    return votes.length;
  }
);

/**
 * Replaces one comment with a row that holds none of the legacy fields. Returns 1 when
 * it did, and 0 for a comment that holds none of them, which is not written.
 */
const stripComment = Effect.fn("comments.migration.stripComment")(function* (
  comment: CommentDoc
) {
  if (!holdsLegacyField(comment)) {
    return 0;
  }
  const writer = yield* DatabaseWriter;
  yield* writer
    .table("comments")
    .replace(
      comment._id,
      Struct.omit(comment, [
        "_id",
        "_creationTime",
        "upvoteCount",
        "downvoteCount",
        "replyToText",
      ])
    )
    .pipe(Effect.orDie);
  return 1;
});

/**
 * Strips one page of comments, in creation order after the cursor, and schedules the
 * next page while the table has more.
 */
const stripPage = Effect.fn("comments.migration.stripPage")(function* (
  cursor: string | undefined
) {
  const reader = yield* DatabaseReader;
  const page = yield* reader
    .table("comments")
    .index("by_creation_time")
    .paginate({ cursor: cursor ?? null, numItems: MIGRATION_BATCH })
    .pipe(Effect.orDie);
  const stripped = yield* Effect.forEach(page.page, stripComment);
  if (!page.isDone) {
    yield* scheduleRun(page.continueCursor);
  }
  return {
    done: page.isDone,
    scanned: page.page.length,
    stripped: Arr.reduce(stripped, 0, (total, count) => total + count),
    votesRemoved: 0,
  };
});

/**
 * Runs one call of the pass. While vote rows are left, it deletes one batch of them and
 * schedules the same cursor again. Once none is left, it strips one page of comments.
 */
const runPass = Effect.fn("comments.migration.runPass")(function* (
  cursor: string | undefined
) {
  const votesRemoved = yield* deleteVoteBatch();
  if (votesRemoved > 0) {
    yield* scheduleRun(cursor);
    return { done: false, scanned: 0, stripped: 0, votesRemoved };
  }
  return yield* stripPage(cursor);
});

/** Runs one call of the strip pass (`migration.spec.ts`) and logs what it did. */
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("comments.migration.run")(function* (args) {
    const result = yield* runPass(args.cursor);
    yield* Effect.logInfo("Comments strip pass", result);
    return result;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  Layer.provide(atomic),
  GroupImpl.finalize
);
