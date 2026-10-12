import { FunctionImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { readLearnerProfile } from "@repo/backend/confect/nina/memory/profile";
import type { Opened } from "@repo/backend/confect/nina/memory/seal";
import { searchMemories } from "@repo/backend/confect/nina/memory/search";
import { startMemories } from "@repo/backend/confect/nina/memory/start";
import { readMemoryState } from "@repo/backend/confect/nina/memory/store";
import spec, {
  MEMORY_KNOWN_LIMIT,
} from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Effect } from "effect";

/**
 * One memory as Nina and the capture call read it, with a kind and a title
 * only when it has one.
 */
function toNote(memory: Opened) {
  return {
    confirmedAt: memory.confirmedAt,
    id: memory._id,
    ...(memory.kind === undefined ? {} : { kind: memory.kind }),
    text: memory.text,
    ...(memory.title === undefined ? {} : { title: memory.title }),
  };
}

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
 * What the capture call reads: the account profile and the at most
 * `MEMORY_KNOWN_LIMIT` memories that match the learner's message and the open
 * page best. While memory is paused, no memory is read, and a memory that
 * "Delete all" took is never read.
 */
export const known = FunctionImpl.make(
  schema,
  spec,
  "known",
  Effect.fn("nina.memory.known")(function* ({ message, now, topics, userId }) {
    const profile = yield* readLearnerProfile(userId);
    const { clearedAt, paused } = yield* readMemoryState(userId);
    if (paused) {
      return { known: [], paused: true, profile };
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
      paused: false,
      profile,
    };
  })
);
