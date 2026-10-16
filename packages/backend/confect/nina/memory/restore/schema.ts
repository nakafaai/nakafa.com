import { Id } from "@repo/backend/confect/_generated/id";
import { NinaMemory } from "@repo/backend/confect/nina/memory.spec";
import { Schema } from "effect";

/**
 * A memory the learner just deleted, kept for the length of the `restore`
 * window (`MEMORY_UNDO`) so that `restore` gives back exactly what was deleted. It
 * holds every stored field of the memory as it was, sealed and never opened
 * (kind, end day, author, confirmation time, topics, words and title), so
 * nothing is computed again. `memoryId` is the id the memory had, which names
 * the record. `keys` are the key rows the memory had in the memory index, so
 * the index comes back as it was. `expiresAt` is when the Undo ends: the
 * record is useless after it, and a scheduled job deletes it.
 */
export const NinaMemoryRestore = Schema.Struct({
  ...NinaMemory.fields,
  expiresAt: Schema.Finite,
  keys: Schema.mutable(Schema.Array(Schema.NonEmptyString)),
  memoryId: Id("ninaMemories"),
});
