import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { insertKeys } from "@repo/backend/confect/nina/memory/keys";
import {
  isCleared,
  MEMORY_BATCH,
  readMemoryState,
} from "@repo/backend/confect/nina/memory/store";
import { viewOf } from "@repo/backend/confect/nina/memory/view";
import {
  MEMORY_UNDO,
  NinaMemoryRejected,
} from "@repo/backend/confect/nina/memory.spec";
import { requestPortrait } from "@repo/backend/confect/nina/portrait/store";
import { Array as Arr, Clock, Duration, Effect, Struct } from "effect";

type UserId = Docs["users"]["_id"];
type MemoryId = Docs["ninaMemories"]["_id"];
type RestoreId = Docs["ninaMemoryRestores"]["_id"];

/**
 * Keeps a memory the learner just deleted, for the length of the restore
 * window (`MEMORY_UNDO`): every stored field as it was, sealed and never
 * opened, the keys the memory had in the index, and the moment the window
 * ends. It schedules the deletion of the record for that moment. The record is
 * in the transaction of the deletion, so a memory is never deleted without it
 * and never kept without being deleted. Only `remove` keeps one: the learner
 * deleting a memory is the one deletion that can be taken back.
 */
export const keepRestore = Effect.fn("nina.memory.restore.keep")(function* (
  memory: Docs["ninaMemories"],
  keys: readonly string[]
) {
  const now = yield* Clock.currentTimeMillis;
  const id = yield* (yield* DatabaseWriter)
    .table("ninaMemoryRestores")
    .insert({
      ...Struct.omit(memory, ["_creationTime", "_id"]),
      expiresAt: now + Duration.toMillis(MEMORY_UNDO),
      keys: Arr.fromIterable(keys),
      memoryId: memory._id,
    })
    .pipe(Effect.orDie);
  yield* (yield* Scheduler).runAfter(
    MEMORY_UNDO,
    refs.internal.nina.memory.purge,
    { id }
  );
});

/**
 * Reads the record of a deleted memory when it can be put back now: it is the
 * learner's, its restore window has not ended, and "Delete all" did not take
 * the memory (see `readMemoryState`), which every reader would hide and no
 * batch might delete. A record that was used is gone, so it is not found
 * either.
 */
const readRestore = Effect.fn("nina.memory.restore.read")(function* (
  userId: UserId,
  memoryId: MemoryId,
  clearedAt: number | undefined
) {
  const record = yield* (yield* DatabaseReader)
    .table("ninaMemoryRestores")
    .get("by_userId_and_memoryId", userId, memoryId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  const now = yield* Clock.currentTimeMillis;
  return record === null ||
    record.expiresAt <= now ||
    isCleared(record, clearedAt)
    ? null
    : record;
});

/**
 * Inserts the memory a record holds, field for field, then its keys and the
 * rows they stood in, and deletes the record so it is used once. Nothing is
 * sealed or computed again: Convex gives the memory a new id and a new
 * creation time, and everything else is as it was. It returns the stored
 * memory.
 */
const putBack = Effect.fn("nina.memory.restore.put")(function* (
  record: Docs["ninaMemoryRestores"]
) {
  const writer = yield* DatabaseWriter;
  const id = yield* writer
    .table("ninaMemories")
    .insert(
      Struct.omit(record, [
        "_creationTime",
        "_id",
        "expiresAt",
        "keys",
        "memoryId",
      ])
    )
    .pipe(Effect.orDie);
  yield* insertKeys(record.userId, id, record.confirmedAt, record.keys);
  yield* writer
    .table("ninaMemoryRestores")
    .delete(record._id)
    .pipe(Effect.orDie);
  return yield* (yield* DatabaseReader)
    .table("ninaMemories")
    .get(id)
    .pipe(Effect.orDie);
});

/**
 * Puts back the memory a learner deleted, named by the id it had, and returns
 * it as the Memory page shows it. It fails with `missing` when there is
 * nothing to put back for the learner. The learner's portrait is built again
 * from scratch (`requestPortrait`), because the memory comes back with the
 * confirmation time it had, which a build that reads on from the time it has
 * read would never meet. It reads the record, the memory state and the
 * learner's key, writes the memory and its key rows (a memory has at most
 * `MEMORY_KEY_LIMIT` of them, in `keys.ts`), and deletes the record.
 */
export const restoreMemory = Effect.fn("nina.memory.restore.memory")(function* (
  userId: UserId,
  memoryId: MemoryId
) {
  const { clearedAt, paused } = yield* readMemoryState(userId);
  const record = yield* readRestore(userId, memoryId, clearedAt);
  if (record === null) {
    return yield* new NinaMemoryRejected({ reason: "missing" });
  }
  const memory = yield* putBack(record);
  yield* requestPortrait({ paused, reset: true, userId });
  return yield* viewOf(memory);
});

/**
 * Deletes a record at the end of its restore window, when it is still there.
 * The learner may have used it, or an account deletion may have taken it.
 */
export const purgeRestore = Effect.fn("nina.memory.restore.purge")(function* (
  id: RestoreId
) {
  const record = yield* (yield* DatabaseReader)
    .table("ninaMemoryRestores")
    .get(id)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (record !== null) {
    yield* (yield* DatabaseWriter)
      .table("ninaMemoryRestores")
      .delete(id)
      .pipe(Effect.orDie);
  }
});

/**
 * Deletes one batch of a learner's records, at most `MEMORY_BATCH`, and tells
 * whether there were any. Account deletion calls it with the other memory
 * rows, before the learner's key goes, because a record holds sealed words.
 */
export const dropRestores = Effect.fn("nina.memory.restore.drop")(function* (
  userId: UserId
) {
  const records = yield* (yield* DatabaseReader)
    .table("ninaMemoryRestores")
    .index("by_userId_and_memoryId", (query) => query.eq("userId", userId))
    .take(MEMORY_BATCH)
    .pipe(Effect.orDie);
  const writer = yield* DatabaseWriter;
  for (const record of records) {
    yield* writer
      .table("ninaMemoryRestores")
      .delete(record._id)
      .pipe(Effect.orDie);
  }
  return Arr.isReadonlyArrayNonEmpty(records);
});
