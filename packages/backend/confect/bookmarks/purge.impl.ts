import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/bookmarks/purge.spec";
import { Effect, Layer } from "effect";

/** Rows deleted from each table by one call: far below the transaction write limit. */
const BATCH_SIZE = 500;

const purgeBookmarks = FunctionImpl.make(
  databaseSchema,
  spec,
  "purgeBookmarks",
  Effect.fn("bookmarks.purge.purgeBookmarks")(function* () {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const bookmarks = yield* database
      .table("bookmarks")
      .index("by_creation_time")
      .take(BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const bookmark of bookmarks) {
      yield* writer.table("bookmarks").delete(bookmark._id).pipe(Effect.orDie);
    }
    const collections = yield* database
      .table("bookmarkCollections")
      .index("by_creation_time")
      .take(BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const collection of collections) {
      yield* writer
        .table("bookmarkCollections")
        .delete(collection._id)
        .pipe(Effect.orDie);
    }
    return { bookmarks: bookmarks.length, collections: collections.length };
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(purgeBookmarks),
  GroupImpl.finalize
);
