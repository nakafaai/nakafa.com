import { FunctionImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { readLearnerProfile } from "@repo/backend/confect/nina/memory/profile";
import { toNote } from "@repo/backend/confect/nina/memory/seal";
import { searchMemories } from "@repo/backend/confect/nina/memory/search";
import { startMemories } from "@repo/backend/confect/nina/memory/start";
import { readMemoryState } from "@repo/backend/confect/nina/memory/store";
import spec, {
  MEMORY_KNOWN_LIMIT,
} from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Effect } from "effect";

/**
 * What a turn starts with: the account profile and the memories for the open
 * page (`startMemories`). While memory is paused, no memory is read, and a
 * memory that "Delete all" took is never read.
 */
export const read = FunctionImpl.make(
  schema,
  spec,
  "read",
  Effect.fn("nina.memory.read")(function* ({ now, topics, userId }) {
    const profile = yield* readLearnerProfile(userId);
    const { clearedAt, paused } = yield* readMemoryState(userId);
    if (paused) {
      return { paused: true, profile, prompt: [] };
    }
    return {
      paused: false,
      profile,
      prompt: Arr.map(
        yield* startMemories(userId, topics, now, clearedAt),
        toNote
      ),
    };
  })
);

/**
 * Whether the learner paused memory. The capture asks it once, before it sends
 * the learner's message to any model and before it reads a single memory, so a
 * paused learner's message goes nowhere. The capture write reads it again as
 * the authority, for a learner who pauses while the models read.
 */
export const paused = FunctionImpl.make(
  schema,
  spec,
  "paused",
  Effect.fn("nina.memory.paused")(function* ({ userId }) {
    return (yield* readMemoryState(userId)).paused;
  })
);

/**
 * What the capture call reads: the account profile and the at most
 * `MEMORY_KNOWN_LIMIT` memories that match the learner's message and the open
 * page best, the best first. While memory is paused, no memory is read, and a
 * memory that "Delete all" took is never read. The caller asks `paused` before
 * it calls this, so the answer carries no pause flag.
 */
export const known = FunctionImpl.make(
  schema,
  spec,
  "known",
  Effect.fn("nina.memory.known")(function* ({ message, now, topics, userId }) {
    const profile = yield* readLearnerProfile(userId);
    const { clearedAt, paused } = yield* readMemoryState(userId);
    if (paused) {
      return { known: [], profile };
    }
    return {
      known: Arr.map(
        yield* searchMemories({
          clearedAt,
          limit: MEMORY_KNOWN_LIMIT,
          now,
          text: message,
          topics,
          userId,
        }),
        toNote
      ),
      profile,
    };
  })
);
