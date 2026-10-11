import type { Docs } from "@repo/backend/confect/_generated/docs";
import { openMemories } from "@repo/backend/confect/nina/memory/seal";
import { searchMemories } from "@repo/backend/confect/nina/memory/search";
import { hasEnded, readNewest } from "@repo/backend/confect/nina/memory/store";
import { MEMORY_START_LIMIT } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Clock, Effect } from "effect";

/**
 * The memories a turn starts with, at most `MEMORY_START_LIMIT`, opened: those
 * linked to the topics of the page the learner has open, the best first, and
 * then, to fill the places that are left, the most recently confirmed ones that
 * are not there yet and have not ended. The learner may have many more. The
 * search reads at most 218 documents, and the fill looks at the newest 16, so
 * this reads a bounded number of documents.
 */
export const startMemories = Effect.fn("nina.memory.start")(function* (
  userId: Docs["users"]["_id"],
  topics: readonly string[]
) {
  const found = yield* searchMemories({
    limit: MEMORY_START_LIMIT,
    topics,
    userId,
  });
  if (Arr.length(found) >= MEMORY_START_LIMIT) {
    return found;
  }
  const now = yield* Clock.currentTimeMillis;
  const recent = yield* openMemories(
    userId,
    yield* readNewest(userId, MEMORY_START_LIMIT * 2)
  );
  return Arr.take(
    Arr.appendAll(
      found,
      Arr.filter(
        recent,
        (memory) =>
          !(
            hasEnded(memory, now) ||
            Arr.some(found, (match) => match._id === memory._id)
          )
      )
    ),
    MEMORY_START_LIMIT
  );
});
