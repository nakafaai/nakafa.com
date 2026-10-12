import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { readLearningPreferenceByUserId } from "@repo/backend/confect/learningPreferences/impl";
import { deleteKeys } from "@repo/backend/confect/nina/memory/keys";
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

/** Whether the learner paused memory. Memory is on until the learner says otherwise. */
export const readPaused = Effect.fn("nina.memory.store.paused")(function* (
  userId: UserId
) {
  const preference = yield* readLearningPreferenceByUserId(userId).pipe(
    Effect.orDie
  );
  return preference?.ninaMemoryPaused === true;
});

/**
 * Reads a learner's most recently confirmed memories, the newest first, at
 * most `limit`. No function reads all the memories of a learner.
 */
export const readNewest = Effect.fn("nina.memory.store.newest")(function* (
  userId: UserId,
  limit: number
) {
  return yield* (yield* DatabaseReader)
    .table("ninaMemories")
    .index(
      "by_userId_and_confirmedAt",
      (query) => query.eq("userId", userId),
      "desc"
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

/** Whether a situation's end date has passed. Other memories never end. */
export function hasEnded(
  memory: Pick<Docs["ninaMemories"], "kind" | "validUntil">,
  now: number
) {
  return (
    memory.kind === "situation" &&
    memory.validUntil !== undefined &&
    memory.validUntil < now
  );
}

/** Deletes one memory and its key rows. */
export const deleteMemory = Effect.fn("nina.memory.store.delete")(function* (
  memoryId: MemoryId
) {
  yield* deleteKeys(memoryId);
  yield* (yield* DatabaseWriter)
    .table("ninaMemories")
    .delete(memoryId)
    .pipe(Effect.orDie);
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

/** Deletes one batch of the memories whose end date is before `now`, and returns how many. */
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
  return Arr.length(ended);
});
