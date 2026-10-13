import { FunctionImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { readLearningPreferenceByUserId } from "@repo/backend/confect/learningPreferences/impl";
import { readLearnerProfile } from "@repo/backend/confect/nina/memory/profile";
import { recallMemories } from "@repo/backend/confect/nina/memory/recall";
import { toNote } from "@repo/backend/confect/nina/memory/seal";
import { searchMemories } from "@repo/backend/confect/nina/memory/search";
import {
  memoryStateOf,
  readMemoryState,
} from "@repo/backend/confect/nina/memory/store";
import spec, {
  MEMORY_KNOWN_LIMIT,
  MEMORY_LOOKUP_LIMIT,
} from "@repo/backend/confect/nina/memory.spec";
import { readPortrait } from "@repo/backend/confect/nina/portrait/store";
import { Array as Arr, Effect } from "effect";

/**
 * What a turn knows about the learner: the account profile, the portrait when
 * they have one (`readPortrait`), and the memories that their message and the
 * open page call up (`recallMemories`). While memory is paused neither the
 * portrait nor a memory is read, and a memory that "Delete all" took is never
 * read.
 */
export const read = FunctionImpl.make(
  schema,
  spec,
  "read",
  Effect.fn("nina.memory.read")(function* ({ now, said, topics, userId }) {
    const preference = yield* readLearningPreferenceByUserId(userId).pipe(
      Effect.orDie
    );
    const profile = yield* readLearnerProfile(userId, preference);
    const { clearedAt, paused } = memoryStateOf(preference);
    if (paused) {
      return { paused: true, profile, recalled: [] };
    }
    const portrait = yield* readPortrait(userId);
    return {
      paused: false,
      ...(portrait === undefined ? {} : { portrait }),
      profile,
      recalled: Arr.map(
        yield* recallMemories({ clearedAt, now, said, topics, userId }),
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
 * What the memory capability finds for Nina's query: the at most
 * `MEMORY_LOOKUP_LIMIT` memories that match its words best. It reads no
 * profile and no portrait. While memory is paused no memory is read and the
 * answer says so, and a memory that "Delete all" took is never read.
 */
export const lookup = FunctionImpl.make(
  schema,
  spec,
  "lookup",
  Effect.fn("nina.memory.lookup")(function* ({ now, query, userId }) {
    const state = yield* readMemoryState(userId);
    if (state.paused) {
      return { memories: [], paused: true };
    }
    return {
      memories: Arr.map(
        yield* searchMemories({
          clearedAt: state.clearedAt,
          limit: MEMORY_LOOKUP_LIMIT,
          now,
          text: query,
          userId,
        }),
        toNote
      ),
      paused: false,
    };
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
    const preference = yield* readLearningPreferenceByUserId(userId).pipe(
      Effect.orDie
    );
    const profile = yield* readLearnerProfile(userId, preference);
    const { clearedAt, paused } = memoryStateOf(preference);
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
