import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  Scheduler,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import spec, {
  type storageSweepArgs,
} from "@repo/backend/confect/storage.spec";
import { Clock, Duration, Effect, Layer, Option } from "effect";

/** Reclaims interrupted uploads after every upload capability has expired. */
export const sweepStorage = Effect.fn("storage.sweep")(function* (
  args: typeof storageSweepArgs.Type
) {
  const database = yield* DatabaseReader;
  const storage = yield* StorageWriter;
  const before =
    args.continuation?.before ??
    (yield* Clock.currentTimeMillis) - Duration.toMillis(Duration.hours(24));
  const page = yield* database
    .table("_storage")
    .index("by_creation_time", (q) => q.lt("_creationTime", before))
    .paginate({
      cursor: args.continuation?.cursor ?? null,
      maximumBytesRead: 256 * 1024,
      maximumRowsRead: 16,
      numItems: 16,
    });
  let deleted = 0;
  for (const file of page.page) {
    const upload = yield* database
      .table("schoolClassForumPendingUploads")
      .index("by_storageId", (q) => q.eq("storageId", file._id))
      .first();
    if (Option.isSome(upload)) {
      continue;
    }
    const attachment = yield* database
      .table("schoolClassForumPostAttachments")
      .index("by_fileId", (q) => q.eq("fileId", file._id))
      .first();
    if (Option.isSome(attachment)) {
      continue;
    }
    const removed = yield* storage.delete(file._id).pipe(
      Effect.as(true),
      Effect.catchTag("BlobNotFoundError", () =>
        Effect.logWarning("Storage deletion will retry on the next sweep").pipe(
          Effect.annotateLogs({ storageId: file._id }),
          Effect.as(false)
        )
      )
    );
    if (removed) {
      deleted += 1;
    }
  }
  if (!page.isDone) {
    const scheduler = yield* Scheduler;
    yield* scheduler.runAfter(Duration.zero, refs.internal.storage.sweep, {
      continuation: { before, cursor: page.continueCursor },
    });
  }
  return { deleted, done: page.isDone, scanned: page.page.length };
}, Effect.orDie);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(FunctionImpl.make(databaseSchema, spec, "sweep", sweepStorage)),
  GroupImpl.finalize
);
