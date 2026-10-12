import type { Docs } from "@repo/backend/confect/_generated/docs";
import { hasEnded } from "@repo/backend/confect/nina/memory/ended";
import { openMemories } from "@repo/backend/confect/nina/memory/seal";
import { searchMemories } from "@repo/backend/confect/nina/memory/search";
import { readNewest } from "@repo/backend/confect/nina/memory/store";
import { MEMORY_START_LIMIT } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Effect, HashSet } from "effect";

/**
 * Memories the fill looks at, the most recently confirmed first: eight times
 * the places there are. A situation that has ended stays stored until the daily
 * job deletes it, so the newest memories may hold many that the fill must skip.
 * The fill finds its places unless 57 or more of the newest 64 are situations
 * that ended.
 */
const FILL_WINDOW = MEMORY_START_LIMIT * 8;

/**
 * The memories a turn starts with, at most `MEMORY_START_LIMIT`, opened: those
 * linked to the topics of the page the learner has open, the best first, and
 * then, to fill the places that are left, the most recently confirmed ones that
 * are not there yet and have not ended. The learner may have many more. The
 * search reads at most 218 documents, the fill looks at the newest 64 and opens
 * only the memories it takes, and the learner's key is read once, so this reads
 * at most 283 documents. `clearedAt` is the moment the learner last asked to
 * delete every memory, or nothing: neither the search nor the fill meets the
 * memories that request took.
 */
export const startMemories = Effect.fn("nina.memory.start")(function* (
  userId: Docs["users"]["_id"],
  topics: readonly string[],
  now: number,
  clearedAt: number | undefined
) {
  const found = yield* searchMemories({
    clearedAt,
    limit: MEMORY_START_LIMIT,
    now,
    topics,
    userId,
  });
  const places = MEMORY_START_LIMIT - Arr.length(found);
  if (places <= 0) {
    return found;
  }
  const taken = HashSet.fromIterable(Arr.map(found, (memory) => memory._id));
  const recent = Arr.take(
    Arr.filter(
      yield* readNewest(userId, FILL_WINDOW, clearedAt),
      (memory) => !(hasEnded(memory, now) || HashSet.has(taken, memory._id))
    ),
    places
  );
  return Arr.appendAll(found, yield* openMemories(userId, recent));
});
