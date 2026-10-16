import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  readLearningPreferenceByUserId,
  setNinaMemoryCleared,
} from "@repo/backend/confect/learningPreferences/impl";
import { deleteKeys } from "@repo/backend/confect/nina/memory/keys";
import { dropPortrait } from "@repo/backend/confect/nina/portrait/store";
import { Array as Arr, Duration, Effect } from "effect";

type UserId = Docs["users"]["_id"];
type MemoryId = Docs["ninaMemories"]["_id"];

/**
 * Memories one call deletes together with their key rows. A memory has at
 * most 104 key rows, so a batch of 25 writes at most 2,625 documents and reads
 * about as many, far below the 16,000 writes and 32,000 reads of one
 * transaction.
 */
export const MEMORY_BATCH = 25;

/**
 * What the learner decided about their memories, as their preference row holds
 * it. `paused` is whether memory is paused, and memory is on until the learner
 * says otherwise. `clearedAt` is the moment they last asked to delete every
 * memory, or nothing when they never did: the memories confirmed at or before
 * it are gone for every reader, though the batches that delete them may still
 * run. A learner without a row decided nothing. A caller that has the row
 * already reads the state from it, and does not read the row again
 * (`readMemoryState`).
 */
export function memoryStateOf(preference: Docs["learningPreferences"] | null) {
  return {
    clearedAt: preference?.ninaMemoryClearedAt,
    paused: preference?.ninaMemoryPaused === true,
  };
}

/** Reads what the learner decided about their memories (`memoryStateOf`). */
export const readMemoryState = Effect.fn("nina.memory.store.state")(function* (
  userId: UserId
) {
  return memoryStateOf(
    yield* readLearningPreferenceByUserId(userId).pipe(Effect.orDie)
  );
});

/**
 * Whether the learner deleted a memory with "Delete all": it was confirmed at
 * or before `clearedAt`. A memory written after the learner asked is confirmed
 * later and stays.
 */
export function isCleared(
  memory: Pick<Docs["ninaMemories"], "confirmedAt">,
  clearedAt: number | undefined
) {
  return clearedAt !== undefined && memory.confirmedAt <= clearedAt;
}

/**
 * The moment a memory the learner writes at `now` is confirmed: after the last
 * "Delete all", never at or before it, so that deletion never takes a memory
 * the learner wrote after asking for it. A clock that has not moved on from the
 * deletion would stamp the memory as one the deletion took. Every reader would
 * hide it, and the batches would delete it, or leave it stored and hidden if
 * they had finished.
 */
export function confirmedAfterClear(
  now: number,
  clearedAt: number | undefined
) {
  return clearedAt === undefined ? now : Math.max(now, clearedAt + 1);
}

/**
 * Reads a learner's most recently confirmed memories that "Delete all" did not
 * take (see `readMemoryState`), the newest first, at most `limit`. `after` is
 * the moment the learner last asked to delete every memory, or a later one,
 * such as the confirmation time a portrait has read up to: only the memories
 * confirmed after it are read. The newest come first, so what the learner
 * deleted is the tail of the index and the range stops before it. No function
 * reads all the memories of a learner.
 */
export const readNewest = Effect.fn("nina.memory.store.newest")(function* (
  userId: UserId,
  limit: number,
  after: number | undefined
) {
  return yield* (yield* DatabaseReader)
    .table("ninaMemories")
    .index(
      "by_userId_and_confirmedAt",
      (query) => {
        const own = query.eq("userId", userId);
        return after === undefined ? own : own.gt("confirmedAt", after);
      },
      "desc"
    )
    .take(limit)
    .pipe(Effect.orDie);
});

/**
 * Reads a learner's memories confirmed after `after`, the oldest first, at most
 * `limit`: the same index range as `readNewest`, read from its other end, so a
 * reader that goes on from the last moment it read meets each memory once.
 * `after` must be the moment the learner last asked to delete every memory
 * (`readMemoryState`) or a later one, because the range starts there and meets
 * what that request took if it starts earlier. No function reads all the
 * memories of a learner.
 */
export const readOldest = Effect.fn("nina.memory.store.oldest")(function* (
  userId: UserId,
  limit: number,
  after: number
) {
  return yield* (yield* DatabaseReader)
    .table("ninaMemories")
    .index(
      "by_userId_and_confirmedAt",
      (query) => query.eq("userId", userId).gt("confirmedAt", after),
      "asc"
    )
    .take(limit)
    .pipe(Effect.orDie);
});

/** Reads one memory when it belongs to the learner, and nothing for any other id. */
export const readOwnMemory = Effect.fn("nina.memory.store.own")(function* (
  userId: UserId,
  memoryId: MemoryId
) {
  const memory = yield* (yield* DatabaseReader)
    .table("ninaMemories")
    .get(memoryId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  return memory?.userId === userId ? memory : null;
});

/**
 * Reads one memory as the learner has it: nothing when it is gone, belongs to
 * another learner, or was taken by "Delete all" (see `readMemoryState`), though
 * the batches that delete it may still run.
 */
export const readKeptMemory = Effect.fn("nina.memory.store.kept")(function* (
  userId: UserId,
  memoryId: MemoryId,
  clearedAt: number | undefined
) {
  const memory = yield* readOwnMemory(userId, memoryId);
  return memory === null || isCleared(memory, clearedAt) ? null : memory;
});

/**
 * Deletes one memory and its key rows, and returns the keys the memory had.
 * Only `remove` keeps them, for an Undo.
 */
export const deleteMemory = Effect.fn("nina.memory.store.delete")(function* (
  memoryId: MemoryId
) {
  const keys = yield* deleteKeys(memoryId);
  yield* (yield* DatabaseWriter)
    .table("ninaMemories")
    .delete(memoryId)
    .pipe(Effect.orDie);
  return keys;
});

/**
 * Deletes one batch of a learner's memories and returns how many it deleted.
 * With `through` it deletes only the memories confirmed up to that moment, so a
 * deletion that goes on in batches never reaches a memory written after the
 * learner asked for it. Without it, as when the account is deleted, every
 * memory goes.
 */
export const deleteBatch = Effect.fn("nina.memory.store.deleteBatch")(
  function* (userId: UserId, through?: number) {
    const memories = yield* (yield* DatabaseReader)
      .table("ninaMemories")
      .index("by_userId_and_confirmedAt", (query) => {
        const own = query.eq("userId", userId);
        return through === undefined ? own : own.lte("confirmedAt", through);
      })
      .take(MEMORY_BATCH)
      .pipe(Effect.orDie);
    for (const memory of memories) {
      yield* deleteMemory(memory._id);
    }
    return Arr.length(memories);
  }
);

/**
 * Deletes one batch of the memories a learner had at `through`, the moment
 * they asked to delete them all, and runs `drain` again for the next while the
 * batch was full, so no transaction deletes them all. A memory the learner or
 * Nina writes while the batches run was confirmed later and stays. It returns
 * how many it deleted.
 */
export const drainMemories = Effect.fn("nina.memory.store.drain")(function* (
  userId: UserId,
  through: number
) {
  const deleted = yield* deleteBatch(userId, through);
  if (deleted === MEMORY_BATCH) {
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      refs.internal.nina.memory.drain,
      { through, userId }
    );
  }
  return deleted;
});

/**
 * Reads a learner's newest record of a deleted memory (see `keepRestore`), the
 * one confirmed last, as a list of at most that one. A record holds the
 * confirmation time its memory had, and the Undo is refused when that is at or
 * before the moment of a "Delete all" (see `clearMemories`).
 */
const readNewestRestore = Effect.fn("nina.memory.store.newestRestore")(
  function* (userId: UserId) {
    return yield* (yield* DatabaseReader)
      .table("ninaMemoryRestores")
      .index(
        "by_userId_and_confirmedAt",
        (query) => query.eq("userId", userId),
        "desc"
      )
      .take(1)
      .pipe(Effect.orDie);
  }
);

/**
 * Deletes every memory the learner has, which is what "Delete all" asks. The
 * batches of `drainMemories` run one after another, so the learner's memory
 * state first keeps the moment (`readMemoryState`). From that transaction on,
 * every reader drops those memories, on every device and for Nina's next turn,
 * until the batches have deleted them.
 *
 * The moment kept is `now`, or the confirmation of the learner's newest memory
 * when that is later, or that of the newest memory they deleted and can still
 * put back (`readNewestRestore`). A memory written after an earlier "Delete
 * all" is confirmed after that request even when the clock had not moved on
 * (`confirmedAfterClear`), so `now` alone could be earlier than a memory that
 * exists, and this request would leave it. It could be earlier than the record
 * of a memory deleted since, and the Undo would then put back a memory the
 * learner deleted before asking to delete everything.
 *
 * The learner's portrait goes in the same transaction: it is derived from the
 * memories and says nothing once they are deleted. A memory written afterwards
 * asks for a new one.
 */
export const clearMemories = Effect.fn("nina.memory.store.clear")(function* (
  userId: UserId,
  now: number
) {
  const { clearedAt } = yield* readMemoryState(userId);
  const newest = yield* readNewest(userId, 1, clearedAt);
  const restorable = yield* readNewestRestore(userId);
  const through = Arr.reduce(
    Arr.appendAll(newest, restorable),
    now,
    (moment, memory) => Math.max(moment, memory.confirmedAt)
  );
  yield* setNinaMemoryCleared({ now: through, userId });
  yield* dropPortrait(userId);
  return yield* drainMemories(userId, through);
});

/**
 * Deletes one batch of the memories whose end date is before `now`, and returns
 * how many. A learner who is left with no memory at all loses the portrait with
 * them, because nothing remains to remember. Every other learner keeps theirs: a
 * portrait holds nothing with an end date.
 */
export const expireBatch = Effect.fn("nina.memory.store.expire")(function* (
  now: number
) {
  const ended = yield* (yield* DatabaseReader)
    .table("ninaMemories")
    // A memory without an end date is indexed before every number, so the
    // lower bound of zero keeps it out.
    .index("by_validUntil", (query) =>
      query.gte("validUntil", 0).lt("validUntil", now)
    )
    .take(MEMORY_BATCH)
    .pipe(Effect.orDie);
  for (const memory of ended) {
    yield* deleteMemory(memory._id);
  }
  for (const userId of Arr.dedupe(Arr.map(ended, (memory) => memory.userId))) {
    if (Arr.isReadonlyArrayEmpty(yield* readNewest(userId, 1, undefined))) {
      yield* dropPortrait(userId);
    }
  }
  return Arr.length(ended);
});
