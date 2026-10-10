import type { Docs } from "@repo/backend/confect/_generated/docs";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import type { VaultField } from "@repo/backend/confect/vault/schema";
import { openText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Effect, Struct } from "effect";

type Memory = Docs["ninaMemories"];
type LearnerKeys = Effect.Success<ReturnType<typeof readLearnerKeys>>;

/** The stored field that every memory's sealed text belongs to. */
export const MEMORY_FIELD = {
  field: "text",
  table: "ninaMemories",
} satisfies typeof VaultField.Type;

/** The stored field that every memory's sealed title belongs to. */
export const TITLE_FIELD = {
  field: "title",
  table: "ninaMemories",
} satisfies typeof VaultField.Type;

/** Opens the text of one stored memory, and its title when it has one. */
const openMemory = Effect.fn("nina.memory.openMemory")(function* (
  keys: LearnerKeys,
  memory: Memory
) {
  const text = yield* openText(keys, MEMORY_FIELD, memory.text);
  const title =
    memory.title === undefined
      ? undefined
      : yield* openText(keys, TITLE_FIELD, memory.title);
  return {
    ...Struct.omit(memory, ["title"]),
    text,
    ...(title === undefined ? {} : { title }),
  };
});

/** Opens the text and the titles of stored memories with keys that are already read. */
export const openWith = Effect.fn("nina.memory.openWith")(function* (
  keys: LearnerKeys,
  memories: readonly Memory[]
) {
  return yield* Effect.forEach(memories, (memory) => openMemory(keys, memory));
});

/** A stored memory with its text and its title opened. */
export type Opened = Effect.Success<ReturnType<typeof openWith>>[number];

/**
 * Opens the text and the titles of a learner's stored memories. A learner with
 * no memories has no key to read, and a memory without its key is a defect.
 */
export const openMemories = Effect.fn("nina.memory.open")(function* (
  userId: Docs["users"]["_id"],
  memories: readonly Memory[]
) {
  if (!Arr.isReadonlyArrayNonEmpty(memories)) {
    return [];
  }
  return yield* openWith(yield* readLearnerKeys(userId), memories);
}, Effect.orDie);
