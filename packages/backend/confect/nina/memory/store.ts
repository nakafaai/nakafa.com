import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { readLearningPreferenceByUserId } from "@repo/backend/confect/learningPreferences/impl";
import { MEMORY_LIMIT } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Effect, Option } from "effect";

type UserId = Docs["users"]["_id"];
type MemoryId = Docs["ninaMemories"]["_id"];

/**
 * Source chats one memory keeps at most. It bounds every read and delete of a
 * memory. A memory said in more chats than this is well confirmed already.
 */
export const SOURCE_LIMIT = 20;

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

/** Reads the chats a memory came from, at most `SOURCE_LIMIT`. */
const readSources = Effect.fn("nina.memory.store.sources")(function* (
  memoryId: MemoryId
) {
  return yield* (yield* DatabaseReader)
    .table("ninaMemorySources")
    .index("by_memoryId", (query) => query.eq("memoryId", memoryId))
    .take(SOURCE_LIMIT)
    .pipe(Effect.orDie);
});

/** Counts the chats a memory came from, up to `SOURCE_LIMIT`. */
export const countSources = Effect.fn("nina.memory.store.countSources")(
  function* (memoryId: MemoryId) {
    return Arr.length(yield* readSources(memoryId));
  }
);

/**
 * Records that a chat said a memory and tells whether the chat is now one of
 * its sources. A chat counts once for a memory, and a memory keeps at most
 * `SOURCE_LIMIT` chats, so a chat past the limit is not recorded and deleting
 * it forgets nothing.
 */
export const addSource = Effect.fn("nina.memory.store.addSource")(function* (
  memory: { readonly id: MemoryId; readonly userId: UserId },
  chatId: Docs["chats"]["_id"]
) {
  const sources = yield* readSources(memory.id);
  if (Arr.some(sources, (source) => source.chatId === chatId)) {
    return true;
  }
  if (Arr.length(sources) >= SOURCE_LIMIT) {
    return false;
  }
  yield* (yield* DatabaseWriter)
    .table("ninaMemorySources")
    .insert({ chatId, memoryId: memory.id, userId: memory.userId })
    .pipe(Effect.orDie);
  return true;
});

/** Deletes a memory with the source rows that point at it. */
export const deleteMemory = Effect.fn("nina.memory.store.delete")(function* (
  memoryId: MemoryId
) {
  const writer = yield* DatabaseWriter;
  for (const source of yield* readSources(memoryId)) {
    yield* writer.table("ninaMemorySources").delete(source._id);
  }
  yield* writer.table("ninaMemories").delete(memoryId);
});

/**
 * Forgets what a deleted chat taught. The chat stops being a source, and a
 * memory Nina wrote with no other source goes too. Memories the learner wrote
 * stay.
 */
export const forgetChat = Effect.fn("nina.memory.store.forgetChat")(function* (
  chat: Pick<Docs["chats"], "_id">
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const sources = yield* reader
    .table("ninaMemorySources")
    .index("by_chatId", (query) => query.eq("chatId", chat._id))
    .take(MEMORY_LIMIT)
    .pipe(Effect.orDie);
  for (const source of sources) {
    yield* writer.table("ninaMemorySources").delete(source._id);
    const remaining = yield* reader
      .table("ninaMemorySources")
      .index("by_memoryId", (query) => query.eq("memoryId", source.memoryId))
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(remaining)) {
      continue;
    }
    const memory = yield* reader
      .table("ninaMemories")
      .get(source.memoryId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (memory?.author === "nina") {
      yield* writer.table("ninaMemories").delete(memory._id);
    }
  }
});

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
