import type { Docs } from "@repo/backend/confect/_generated/docs";
import { hasEnded } from "@repo/backend/confect/nina/memory/ended";
import { openMemories } from "@repo/backend/confect/nina/memory/seal";
import { searchMemories } from "@repo/backend/confect/nina/memory/search";
import { readNewest } from "@repo/backend/confect/nina/memory/store";
import {
  MEMORY_RECALL_FLOOR,
  MEMORY_RECALL_LIMIT,
} from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Effect, HashSet } from "effect";

/**
 * Memories the fill looks at, the most recently confirmed first: eight times
 * the places there are. A situation that has ended stays stored until the daily
 * job deletes it, so the newest memories may hold some that the fill must skip.
 * The fill finds its places unless 22 or more of the newest 24 are situations
 * that ended.
 */
const FILL_WINDOW = MEMORY_RECALL_FLOOR * 8;

/**
 * The memories a turn recalls, at most `MEMORY_RECALL_LIMIT`, opened: those that
 * the learner's message (`said`) and the topics of the page they have open call
 * up, the best first (`searchMemories`). When fewer than `MEMORY_RECALL_FLOOR`
 * match, the most recently confirmed ones that are not there yet and have not
 * ended fill the list up to it, so a learner with a few memories is still known
 * whatever they ask. The learner may have many more: the memory capability
 * searches them.
 *
 * The search reads at most 410 documents (one memory to know there is one, the
 * learner's key, 16 times 24 key rows, and 24 memories), the fill looks at the
 * newest 24 and opens only the memories it takes, and the learner's key is read
 * once more for them. `clearedAt` is the moment the learner last asked to
 * delete every memory, or nothing: neither the search nor the fill meets the
 * memories that request took.
 */
export const recallMemories = Effect.fn("nina.memory.recall")(function* ({
  clearedAt,
  now,
  said,
  topics,
  userId,
}: {
  readonly clearedAt: number | undefined;
  readonly now: number;
  readonly said: string;
  readonly topics: readonly string[];
  readonly userId: Docs["users"]["_id"];
}) {
  const found = yield* searchMemories({
    clearedAt,
    limit: MEMORY_RECALL_LIMIT,
    now,
    text: said,
    topics,
    userId,
  });
  const places = MEMORY_RECALL_FLOOR - Arr.length(found);
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
