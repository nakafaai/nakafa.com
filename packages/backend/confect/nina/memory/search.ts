import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  readLinked,
  topicKey,
  wordKey,
} from "@repo/backend/confect/nina/memory/keys";
import { openWith } from "@repo/backend/confect/nina/memory/seal";
import {
  hasEnded,
  readNewest,
  readOwnMemory,
} from "@repo/backend/confect/nina/memory/store";
import { isLesson } from "@repo/backend/confect/nina/memory/topics";
import { wordsOf } from "@repo/backend/confect/nina/memory/words";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import {
  Array as Arr,
  Clock,
  Effect,
  Option,
  Order,
  Record as Rec,
  String as Str,
} from "effect";

/** A stored memory with the score its matched keys earned. */
type Scored = readonly [Docs["ninaMemories"], number];

/** Keys one search looks up at most, the topics first. */
const KEY_LIMIT = 16;
/** Key rows read for each key: the memories most recently linked to it. */
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

/** The highest score first, whatever the score belongs to. */
const highestScore = Order.mapInput(
  Order.flip(Order.Number),
  ([, score]: readonly [unknown, number]) => score
);

/** The highest score first, then the memory confirmed last. */
const bestFirst = Order.combineAll<Scored>([
  highestScore,
  Order.mapInput(
    Order.flip(Order.Number),
    ([memory]: Scored) => memory.confirmedAt
  ),
]);

/**
 * Finds the memories of a learner that match some text and some topics, the
 * best first, opened. This is the one place that searches the index of
 * `memory/keys`: nothing else reads key rows to find a memory.
 *
 * The text becomes words, in the one way the writer of the index does it
 * (`memory/words`), and a word is looked up by its blind hash, so the database
 * never reads it. At most 16 keys are looked up, the topics first, and a key
 * finds the 24 memories most recently linked to it. A memory scores what its
 * matched keys are worth: 3 for the lesson that is open, 2 for a path above
 * it, 1 for a word. The best `limit * 3` memories, 48 at most, are loaded;
 * those that are gone or are situations that ended are dropped; the rest go by
 * score, then by confirmation, the newest first, and the first `limit` are
 * opened. With no word and no topic it finds nothing.
 *
 * It reads a bounded number of documents whatever the learner keeps: one
 * memory to know there is one, the learner's key, at most 16 times 24 key rows
 * (384), and at most 48 memories. That is 434 documents of the 32,000 one
 * transaction may read. A common word finds the recent memories that hold it,
 * not every one.
 */
export const searchMemories = Effect.fn("nina.memory.find")(function* ({
  limit,
  text = "",
  topics = [],
  userId,
}: {
  readonly limit: number;
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
  // A learner who never wrote a memory has no key to read and nothing to find.
  if (
    (Arr.isReadonlyArrayEmpty(topicLookups) &&
      Arr.isReadonlyArrayEmpty(words)) ||
    Arr.isReadonlyArrayEmpty(yield* readNewest(userId, 1))
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
      Effect.map(readLinked(userId, key, LINKED_PER_KEY), (memoryIds) =>
        Arr.map(memoryIds, (memoryId) => [memoryId, worth] as const)
      )
    )
  );
  // Each memory once, in the order it was first met, the best score first.
  const ranked = Arr.sort(
    Arr.map(
      Rec.values(Arr.groupBy(hits, ([memoryId]) => memoryId)),
      (group) =>
        [
          Arr.headNonEmpty(group)[0],
          Arr.reduce(group, 0, (total, [, worth]) => total + worth),
        ] as const
    ),
    highestScore
  );
  const now = yield* Clock.currentTimeMillis;
  const loaded = Arr.filter(
    Arr.getSomes(
      yield* Effect.forEach(
        Arr.take(ranked, Math.min(limit * LOAD_FACTOR, LOAD_LIMIT)),
        ([memoryId, score]) =>
          Effect.map(readOwnMemory(userId, memoryId), (memory) =>
            Option.map(
              Option.fromNullOr(memory),
              (found): Scored => [found, score]
            )
          )
      )
    ),
    ([memory]) => !hasEnded(memory, now)
  );
  return yield* openWith(
    keys,
    Arr.map(Arr.take(Arr.sort(loaded, bestFirst), limit), ([memory]) => memory)
  );
}, Effect.orDie);
