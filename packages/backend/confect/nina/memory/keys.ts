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
import { Array as Arr, Effect, HashSet, Struct } from "effect";

type UserId = Docs["users"]["_id"];
type MemoryId = Docs["ninaMemories"]["_id"];
type LearnerKeys = Effect.Success<ReturnType<typeof readLearnerKeys>>;

/**
 * The version of what a word is (`memory/words`). It is part of the input of
 * every word key, so a key made under another version can never equal a key
 * made under this one, and a search never finds a word by a key of a word that
 * meant something else. Version 1 read words by rules of its own, and its keys
 * are blinded for the field `words`. Version 2 reads them from the word
 * boundaries of the platform (`Intl.Segmenter`), with no list and no minimum
 * length. Change what a word is, and this number changes with it; a memory is
 * re-keyed the next time it is written (`syncKeys` deletes the keys it should
 * not have). A new version ships with a job that re-keys the memories no write
 * touches and is deleted once it has run (ADR 0022).
 */
const WORD_INDEX_VERSION = 2;

/**
 * The field every word key is blinded for. The words of a memory's title and
 * its text share one index, so one field names them both, and the version of
 * the index names the field.
 */
const WORDS_FIELD = {
  field: `words/v${WORD_INDEX_VERSION}`,
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
 * Inserts key rows for a memory, each holding the time the memory was
 * confirmed. `syncKeys` inserts the keys a memory lacks with it, and `restore`
 * inserts the keys a deleted memory had.
 */
export const insertKeys = Effect.fn("nina.memory.keys.insert")(function* (
  userId: UserId,
  memoryId: MemoryId,
  confirmedAt: number,
  keys: readonly string[]
) {
  const writer = yield* DatabaseWriter;
  for (const key of keys) {
    yield* writer
      .table("ninaMemoryKeys")
      .insert({ confirmedAt, key, memoryId, userId })
      .pipe(Effect.orDie);
  }
});

/**
 * Moves key rows to the time their memory was confirmed, and leaves the rows
 * that hold that time as they are. A row is written back whole with `replace`,
 * which saves the read that a `patch` makes first. It returns how many rows it
 * moved.
 */
const moveKeys = Effect.fn("nina.memory.keys.move")(function* (
  rows: readonly Docs["ninaMemoryKeys"][],
  confirmedAt: number
) {
  const writer = yield* DatabaseWriter;
  const behind = Arr.filter(rows, (row) => row.confirmedAt !== confirmedAt);
  for (const row of behind) {
    yield* writer
      .table("ninaMemoryKeys")
      .replace(row._id, {
        ...Struct.omit(row, ["_creationTime", "_id"]),
        confirmedAt,
      })
      .pipe(Effect.orDie);
  }
  return Arr.length(behind);
});

/**
 * Keeps the key rows of a memory in step with what the memory says. The memory
 * should have a key for each of its topics and for each of its first 96 words,
 * the words of its title ahead of its text's, and each key should hold the
 * time the memory was confirmed. The function deletes the rows it should not
 * have, moves the rows it keeps to that time, and inserts the keys it has not
 * got. Every writer of a memory calls it in the same transaction, so a memory
 * and its keys never differ. It reads at most 104 rows and writes at most 208:
 * a write for each row it deletes or moves and for each key it inserts, and it
 * returns how many it wrote. A word key of another version of the index
 * (`WORD_INDEX_VERSION`) is a row the memory should not have, so a memory is
 * re-keyed by its next sync.
 */
export const syncKeys = Effect.fn("nina.memory.keys.sync")(function* (
  keys: LearnerKeys,
  memoryId: MemoryId,
  content: {
    readonly confirmedAt: number;
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
  const current = Arr.filter(stored, (row) => HashSet.has(wanted, row.key));
  const gone = Arr.filter(stored, (row) => !HashSet.has(wanted, row.key));
  yield* dropKeys(gone);
  const moved = yield* moveKeys(current, content.confirmedAt);
  const kept = HashSet.fromIterable(Arr.map(current, (row) => row.key));
  const missing = Arr.filter(
    Arr.fromIterable(wanted),
    (key) => !HashSet.has(kept, key)
  );
  yield* insertKeys(keys.userId, memoryId, content.confirmedAt, missing);
  return Arr.length(gone) + moved + Arr.length(missing);
}, Effect.orDie);

/**
 * Deletes every key row of a memory and returns the keys it deleted, so that
 * `remove` can keep them for an Undo. Every path that deletes a memory calls it.
 */
export const deleteKeys = Effect.fn("nina.memory.keys.delete")(function* (
  memoryId: MemoryId
) {
  const rows = yield* storedKeys(memoryId);
  yield* dropKeys(rows);
  return Arr.map(rows, (row) => row.key);
});

/**
 * The memories a learner has linked to one key, the most recently confirmed
 * first, at most `limit`, each with the time it was confirmed. A key holds the
 * time its memory was confirmed, so the memories that "Delete all" took (those
 * confirmed at or before `clearedAt`) are the tail of the index, and the range
 * stops before them.
 */
export const readLinked = Effect.fn("nina.memory.keys.linked")(function* (
  userId: UserId,
  key: string,
  limit: number,
  clearedAt: number | undefined
) {
  const rows = yield* (yield* DatabaseReader)
    .table("ninaMemoryKeys")
    .index(
      "by_userId_and_key_and_confirmedAt",
      (query) => {
        const linked = query.eq("userId", userId).eq("key", key);
        return clearedAt === undefined
          ? linked
          : linked.gt("confirmedAt", clearedAt);
      },
      "desc"
    )
    .take(limit)
    .pipe(Effect.orDie);
  return Arr.map(rows, Struct.pick(["confirmedAt", "memoryId"]));
});
