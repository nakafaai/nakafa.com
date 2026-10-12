import type { Docs } from "@repo/backend/confect/_generated/docs";
import { hasEnded } from "@repo/backend/confect/nina/memory/ended";
import {
  readLinked,
  topicKey,
  wordKey,
} from "@repo/backend/confect/nina/memory/keys";
import { openWith } from "@repo/backend/confect/nina/memory/seal";
import {
  readNewest,
  readOwnMemory,
} from "@repo/backend/confect/nina/memory/store";
import { isLesson } from "@repo/backend/confect/nina/memory/topics";
import { wordsOf } from "@repo/backend/confect/nina/memory/words";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import {
  Array as Arr,
  Effect,
  Option,
  Order,
  Record as Rec,
  String as Str,
} from "effect";

/** Keys one search looks up at most, the topics first. */
const KEY_LIMIT = 16;
/** Memories read for each key: the ones confirmed last. */
const LINKED_PER_KEY = 24;
/** Memories loaded for each memory returned, because some are gone or have ended. */
const LOAD_FACTOR = 3;
/** Memories one search loads at most, whatever `limit` is. */
const LOAD_LIMIT = 48;
/** Characters of the text that count. Sixteen keys need far fewer. */
const TEXT_LIMIT = 1000;
/** What a matched key adds to a memory's score: the open lesson, a path above it, a word. */
const LESSON_WORTH = 3;
const PATH_WORTH = 2;
const WORD_WORTH = 1;

/** The highest score first, then the memory confirmed last. */
const bestFirst = Order.Tuple([
  Order.flip(Order.Number),
  Order.flip(Order.Number),
]);

/**
 * Finds the memories of a learner that match some text and some topics, the
 * best first, opened. This is the one place that searches the index of
 * `memory/keys`: nothing else reads key rows to find a memory.
 *
 * The text becomes words, in the one way the writer of the index does it
 * (`memory/words`), and a word is looked up by its blind hash, so the database
 * never reads it. At most 16 keys are looked up, the topics first, and a key
 * finds the 24 memories confirmed last that are linked to it. A memory scores
 * what its matched keys are worth: 3 for the lesson that is open, 2 for a path
 * above it, 1 for a word. The memories go by score, then by confirmation, the
 * newest first. The best `limit * 3`, 48 at most, are loaded; those that are
 * gone drop out, and with `now` so do the situations that ended before it; and
 * the first `limit` of the rest are opened. With no word and no topic it finds
 * nothing.
 *
 * It never reads the clock, because it runs inside queries and a query is not
 * run again when time passes: a caller that must not see ended situations says
 * what time it is. Without a time it sees every stored memory.
 *
 * It never finds a memory that "Delete all" took, though the batches that
 * delete it may still run. `clearedAt` is the moment the learner asked, from
 * `readMemoryState`, or nothing when they never did. The keys hold the time
 * their memory was confirmed and the index orders them by it, so what the
 * learner deleted is the tail of each key and the range stops before it: those
 * memories take none of the 24 places of a key.
 *
 * It reads a bounded number of documents whatever the learner keeps: one
 * memory to know there is one, the learner's key, at most 16 times 24 key rows
 * (384), and at most 48 memories. That is 434 documents of the 32,000 one
 * transaction may read. A common word finds the memories confirmed last that
 * hold it, not every one.
 */
export const searchMemories = Effect.fn("nina.memory.find")(function* ({
  clearedAt,
  limit,
  now,
  text = "",
  topics = [],
  userId,
}: {
  readonly clearedAt: number | undefined;
  readonly limit: number;
  readonly now?: number;
  readonly text?: string;
  readonly topics?: readonly string[];
  readonly userId: Docs["users"]["_id"];
}) {
  const topicLookups = Arr.map(
    Arr.take(topics, KEY_LIMIT),
    (topic) =>
      [topicKey(topic), isLesson(topic) ? LESSON_WORTH : PATH_WORTH] as const
  );
  const words = Arr.take(
    wordsOf(Str.slice(0, TEXT_LIMIT)(text)),
    KEY_LIMIT - Arr.length(topicLookups)
  );
  // A learner who has no memory has no key to read and nothing to find.
  if (
    (Arr.isReadonlyArrayEmpty(topicLookups) &&
      Arr.isReadonlyArrayEmpty(words)) ||
    Arr.isReadonlyArrayEmpty(yield* readNewest(userId, 1, clearedAt))
  ) {
    return [];
  }
  const keys = yield* readLearnerKeys(userId);
  const lookups = Arr.appendAll(
    topicLookups,
    yield* Effect.forEach(words, (word) =>
      Effect.map(wordKey(keys, word), (key) => [key, WORD_WORTH] as const)
    )
  );
  const hits = Arr.flatten(
    yield* Effect.forEach(lookups, ([key, worth]) =>
      Effect.map(readLinked(userId, key, LINKED_PER_KEY, clearedAt), (linked) =>
        Arr.map(linked, ({ confirmedAt, memoryId }) => ({
          confirmedAt,
          memoryId,
          worth,
        }))
      )
    )
  );
  // Each memory once, with what the keys that matched it are worth together.
  const scored = Arr.map(
    Rec.values(Arr.groupBy(hits, ({ memoryId }) => memoryId)),
    (group) => ({
      confirmedAt: Arr.headNonEmpty(group).confirmedAt,
      memoryId: Arr.headNonEmpty(group).memoryId,
      score: Arr.reduce(group, 0, (total, { worth }) => total + worth),
    })
  );
  const ranked = Arr.sortWith(
    scored,
    ({ confirmedAt, score }) => [score, confirmedAt] as const,
    bestFirst
  );
  const loaded = Arr.getSomes(
    yield* Effect.forEach(
      Arr.take(ranked, Math.min(limit * LOAD_FACTOR, LOAD_LIMIT)),
      ({ memoryId }) =>
        Effect.map(readOwnMemory(userId, memoryId), Option.fromNullOr)
    )
  );
  const lasting =
    now === undefined
      ? loaded
      : Arr.filter(loaded, (memory) => !hasEnded(memory, now));
  return yield* openWith(keys, Arr.take(lasting, limit));
}, Effect.orDie);
