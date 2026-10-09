import { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  MutationCtx,
  Scheduler,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/storage.spec";
import { Array as Arr, Duration, Effect, HashSet, Layer, Schema } from "effect";

class StorageSweepError extends Schema.TaggedError<StorageSweepError>()(
  "StorageSweepError",
  { cause: Schema.Unknown }
) {}

const BATCH_SIZE = 16;

/** Agent owns reference counts; component rows and blobs retire atomically. */
export const sweepStorage = Effect.fn("storage.sweep")(function* () {
  const ctx = yield* MutationCtx;
  const database = yield* DatabaseReader;
  const storage = yield* StorageWriter;
  const page = yield* Effect.tryPromise({
    try: () =>
      ctx.runQuery(components.nina.files.getFilesToDelete, {
        paginationOpts: { cursor: null, numItems: BATCH_SIZE },
      }),
    catch: (cause) => StorageSweepError.make({ cause }),
  });
  const removed = yield* Effect.tryPromise({
    try: () =>
      ctx.runMutation(components.nina.files.deleteFiles, {
        fileIds: Arr.map(page.page, (file) => file._id),
      }),
    catch: (cause) => StorageSweepError.make({ cause }),
  });
  const deleted = HashSet.fromIterable(removed);
  for (const file of page.page) {
    if (!HashSet.has(deleted, file._id)) {
      continue;
    }
    const storageId = yield* Schema.decodeUnknownEffect(
      GenericId.GenericId("_storage")
    )(file.storageId);
    const metadata = yield* database
      .table("_storage")
      .get(storageId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
    if (metadata) {
      // A storage failure must also roll back the component deletion.
      yield* storage.delete(storageId);
    }
  }
  const done = page.page.length < BATCH_SIZE;
  if (!done) {
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      refs.internal.storage.sweep,
      {}
    );
  }
  return { deleted: HashSet.size(deleted), done, scanned: page.page.length };
}, Effect.orDie);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(FunctionImpl.make(schema, spec, "sweep", sweepStorage)),
  GroupImpl.finalize
);
