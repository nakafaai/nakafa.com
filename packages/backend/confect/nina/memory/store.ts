import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { readLearningPreferenceByUserId } from "@repo/backend/confect/learningPreferences/impl";
import { MEMORY_LIMIT } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Effect } from "effect";

type UserId = Docs["users"]["_id"];
type MemoryId = Docs["ninaMemories"]["_id"];

/** Whether the learner paused memory. Memory is on until the learner says otherwise. */
export const readPaused = Effect.fn("nina.memory.store.paused")(function* (
  userId: UserId
) {
  const preference = yield* readLearningPreferenceByUserId(userId).pipe(
    Effect.orDie
  );
  return preference?.ninaMemoryPaused === true;
});

/** Reads a learner's memories, at most `limit`: a learner keeps `MEMORY_LIMIT`. */
export const readMemories = Effect.fn("nina.memory.store.read")(function* (
  userId: UserId,
  limit = MEMORY_LIMIT
) {
  return yield* (yield* DatabaseReader)
    .table("ninaMemories")
    .index("by_userId", (query) => query.eq("userId", userId))
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

/** Deletes one memory. */
export const deleteMemory = Effect.fn("nina.memory.store.delete")(function* (
  memoryId: MemoryId
) {
  yield* (yield* DatabaseWriter)
    .table("ninaMemories")
    .delete(memoryId)
    .pipe(Effect.orDie);
});

/** Deletes every memory of a learner. */
export const deleteMemories = Effect.fn("nina.memory.store.deleteAll")(
  function* (userId: UserId) {
    for (const memory of yield* readMemories(userId)) {
      yield* deleteMemory(memory._id);
    }
  }
);

/** Memories one expiry call deletes, so its writes stay far below the transaction limit. */
export const EXPIRY_PAGE = 200;

/** Deletes one page of the memories whose end date is before `now`, and returns how many. */
export const expireMemories = Effect.fn("nina.memory.store.expire")(function* (
  now: number
) {
  const ended = yield* (yield* DatabaseReader)
    .table("ninaMemories")
    // A memory without an end date is indexed before every number, so the
    // lower bound of zero keeps it out.
    .index("by_validUntil", (query) =>
      query.gte("validUntil", 0).lt("validUntil", now)
    )
    .take(EXPIRY_PAGE)
    .pipe(Effect.orDie);
  for (const memory of ended) {
    yield* deleteMemory(memory._id);
  }
  return Arr.length(ended);
});
