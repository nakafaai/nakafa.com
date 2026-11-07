import { FunctionImpl, GroupImpl } from "@confect/server";
import bucketInternal from "@repo/backend/confect/_generated/refs/bucket.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { deleteFile, reserveFile } from "@repo/backend/confect/bucket/file";
import { removeObject } from "@repo/backend/confect/bucket/object";
import spec from "@repo/backend/confect/bucket.spec";
import { FetchClient } from "@repo/utilities/http/client";
import { Clock, Duration, Effect, Layer, Option, Schedule } from "effect";

/** How long a reserved file waits for its upload before the sweep deletes it. */
const RESERVATION_AGE = Duration.hours(2);

/** The files one sweep reads, so one transaction stays small; a full batch runs the sweep again at once. */
const SWEEP_BATCH = 64;

/** One file's facts, when its row exists. */
const file = FunctionImpl.make(
  databaseSchema,
  spec,
  "file",
  Effect.fn("bucket.file")(function* ({ fileId }) {
    const found = yield* (yield* DatabaseReader)
      .table("bucketFiles")
      .get(fileId)
      .pipe(Effect.option);
    return Option.match(found, {
      onNone: () => null,
      onSome: (row) => ({
        byteSize: row.byteSize,
        contentType: row.contentType,
        objectKey: row.objectKey,
        tenantId: row.tenantId ?? null,
      }),
    });
  })
);

/** Marks a file stored once the server saw its bytes or wrote them itself. A file already gone changes nothing. */
const markStored = FunctionImpl.make(
  databaseSchema,
  spec,
  "markStored",
  Effect.fn("bucket.markStored")(function* ({ fileId }) {
    const found = yield* (yield* DatabaseReader)
      .table("bucketFiles")
      .get(fileId)
      .pipe(Effect.option);
    if (Option.isSome(found)) {
      yield* (yield* DatabaseWriter)
        .table("bucketFiles")
        .patch(fileId, { state: "stored" })
        .pipe(Effect.orDie);
    }
    return null;
  })
);

/** Reserves a file for bytes the server writes itself. */
const reserveStored = FunctionImpl.make(
  databaseSchema,
  spec,
  "reserveStored",
  Effect.fn("bucket.reserveStored")(function* (request) {
    return yield* reserveFile(request);
  })
);

/** Deletes a file that an action refused or no longer needs. */
const discard = FunctionImpl.make(
  databaseSchema,
  spec,
  "discard",
  Effect.fn("bucket.discard")(function* ({ fileId }) {
    yield* deleteFile(fileId);
    return null;
  })
);

/** Removes objects from the bucket, each retried, so a deleted file leaves no bytes behind. */
const removeObjects = FunctionImpl.make(
  databaseSchema,
  spec,
  "removeObjects",
  Effect.fn("bucket.removeObjects")(
    function* ({ keys }) {
      yield* Effect.forEach(
        keys,
        (key) =>
          removeObject(key).pipe(
            Effect.retry({
              schedule: Schedule.exponential(Duration.millis(200)),
              times: 3,
            })
          ),
        { concurrency: 4, discard: true }
      );
      return null;
    },
    Effect.provide(FetchClient),
    Effect.orDie
  )
);

/** The daily sweep: files reserved for an upload that never arrived free their bytes and objects. */
const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("bucket.sweep")(function* () {
    const now = yield* Clock.currentTimeMillis;
    const stale = yield* (yield* DatabaseReader)
      .table("bucketFiles")
      .index("by_state_and_createdAt", (query) =>
        query
          .eq("state", "reserved")
          .lt("createdAt", now - Duration.toMillis(RESERVATION_AGE))
      )
      .take(SWEEP_BATCH)
      .pipe(Effect.orDie);
    yield* Effect.forEach(stale, (row) => deleteFile(row._id), {
      discard: true,
    });
    if (stale.length === SWEEP_BATCH) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        bucketInternal.sweep,
        {}
      );
    }
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(file),
  Layer.provide(markStored),
  Layer.provide(reserveStored),
  Layer.provide(discard),
  Layer.provide(removeObjects),
  Layer.provide(sweep),
  GroupImpl.finalize
);
