import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { wordsOf } from "@repo/backend/confect/nina/memory/words";
import { MEMORY_TOPIC_LIMIT } from "@repo/backend/confect/nina/memory.spec";
import type { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import type { VaultField } from "@repo/backend/confect/vault/schema";
import { blindText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Effect, HashSet } from "effect";

type UserId = Docs["users"]["_id"];
type MemoryId = Docs["ninaMemories"]["_id"];
type LearnerKeys = Effect.Success<ReturnType<typeof readLearnerKeys>>;

/**
 * The field every word key is blinded for. The words of a memory's title and
 * its text share one index, so one field names them both.
 */
const WORDS_FIELD = {
  field: "words",
  table: "ninaMemories",
} satisfies typeof VaultField.Type;

/** Words of a memory that are indexed: the words of its title first, then its text's. */
const WORD_KEY_LIMIT = 96;

/** Keys one memory has at most: a key for each topic and each indexed word. */
const MEMORY_KEY_LIMIT = MEMORY_TOPIC_LIMIT + WORD_KEY_LIMIT;

/** The key of a topic, in plain text: topics name pages of Nakafa, not the learner. */
export function topicKey(topic: string) {
  return `t:${topic}`;
}

/**
 * The key of a word: a keyed hash that only this learner's key can make. The
 * database matches the same word again without being able to read it, and
 * never finds a word of another learner.
 */
export const wordKey = Effect.fn("nina.memory.keys.word")(function* (
  keys: LearnerKeys,
  word: string
) {
  return `w:${yield* blindText(keys, WORDS_FIELD, word)}`;
});

/** Reads the key rows of one memory. A memory has at most `MEMORY_KEY_LIMIT`. */
const storedKeys = Effect.fn("nina.memory.keys.stored")(function* (
  memoryId: MemoryId
) {
  return yield* (yield* DatabaseReader)
    .table("ninaMemoryKeys")
    .index("by_memoryId", (query) => query.eq("memoryId", memoryId))
    .take(MEMORY_KEY_LIMIT)
    .pipe(Effect.orDie);
});

/** Deletes key rows. */
const dropKeys = Effect.fn("nina.memory.keys.drop")(function* (
  rows: readonly Docs["ninaMemoryKeys"][]
) {
  const writer = yield* DatabaseWriter;
  for (const row of rows) {
    yield* writer.table("ninaMemoryKeys").delete(row._id).pipe(Effect.orDie);
  }
});

/**
 * Keeps the key rows of a memory in step with what the memory says. The memory
 * should have a key for each of its topics and for each of its first 96 words,
 * the words of its title ahead of its text's. The function inserts the keys it
 * has not got and deletes the rows it should not have. Every writer of a memory
 * calls it in the same transaction, so a memory and its keys never differ. It
 * reads at most 104 rows and writes at most as many.
 */
export const syncKeys = Effect.fn("nina.memory.keys.sync")(function* (
  keys: LearnerKeys,
  memoryId: MemoryId,
  content: {
    readonly text: string;
    readonly title?: string | undefined;
    readonly topics?: readonly string[] | undefined;
  }
) {
  const words = Arr.take(
    Arr.dedupe(
      Arr.appendAll(wordsOf(content.title ?? ""), wordsOf(content.text))
    ),
    WORD_KEY_LIMIT
  );
  const wanted = HashSet.fromIterable(
    Arr.appendAll(
      Arr.map(content.topics ?? [], topicKey),
      yield* Effect.forEach(words, (word) => wordKey(keys, word))
    )
  );
  const stored = yield* storedKeys(memoryId);
  const kept = HashSet.fromIterable(Arr.map(stored, (row) => row.key));
  yield* dropKeys(Arr.filter(stored, (row) => !HashSet.has(wanted, row.key)));
  const writer = yield* DatabaseWriter;
  for (const key of wanted) {
    if (!HashSet.has(kept, key)) {
      yield* writer
        .table("ninaMemoryKeys")
        .insert({ key, memoryId, userId: keys.userId })
        .pipe(Effect.orDie);
    }
  }
}, Effect.orDie);

/** Deletes every key row of a memory. Every path that deletes a memory calls it. */
export const deleteKeys = Effect.fn("nina.memory.keys.delete")(function* (
  memoryId: MemoryId
) {
  yield* dropKeys(yield* storedKeys(memoryId));
});

/**
 * The memories a learner has linked to one key, the most recently linked
 * first, at most `limit`.
 */
export const readLinked = Effect.fn("nina.memory.keys.linked")(function* (
  userId: UserId,
  key: string,
  limit: number
) {
  const rows = yield* (yield* DatabaseReader)
    .table("ninaMemoryKeys")
    .index(
      "by_userId_and_key",
      (query) => query.eq("userId", userId).eq("key", key),
      "desc"
    )
    .take(limit)
    .pipe(Effect.orDie);
  return Arr.map(rows, (row) => row.memoryId);
});
