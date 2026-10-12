import type { Docs } from "@repo/backend/confect/_generated/docs";
import { readKeptMemory } from "@repo/backend/confect/nina/memory/store";
import type { NinaMemorySeen } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Effect, Option } from "effect";

type Seen = typeof NinaMemorySeen.Type;

/**
 * Whether a memory that the capture call listed is gone now. The learner
 * removed or cleared it while the model read the message, or it ended and was
 * deleted, so what the call knows is out of date and writing from it could bring
 * back what the learner deleted. A memory that "Delete all" took (confirmed at
 * or before `clearedAt`) is gone too, though the batches that delete it may
 * still run. The call lists at most 12 memories, and each is looked up by its id.
 */
export const lostSeen = Effect.fn("nina.memory.seen.lost")(function* (
  userId: Docs["users"]["_id"],
  seen: readonly Seen[],
  clearedAt: number | undefined
) {
  const found = yield* Effect.forEach(seen, ({ id }) =>
    readKeptMemory(userId, id, clearedAt)
  );
  return Arr.some(found, (memory) => memory === null);
});

/**
 * The memory that a candidate names, as it stands now. The model names a memory
 * by its place on the list the call gave it, counted from 1, and `seen` is that
 * list in its order. The model may name any number, so a place that is not on
 * the list names nothing, and nothing is looked up for it. A memory that
 * "Delete all" took names nothing either.
 */
export const readNamed = Effect.fn("nina.memory.seen.named")(function* (
  userId: Docs["users"]["_id"],
  seen: readonly Seen[],
  known: number | undefined,
  clearedAt: number | undefined
) {
  const note = Option.flatMap(Option.fromUndefinedOr(known), (place) =>
    Arr.get(seen, place - 1)
  );
  return Option.isSome(note)
    ? Option.fromNullOr(yield* readKeptMemory(userId, note.value.id, clearedAt))
    : Option.none();
});

/**
 * Whether a memory is as the capture call read it. One that was confirmed or
 * edited after the call read it, and one the call never read, is not: what it
 * holds is newer than the message, so the message does not rewrite its words,
 * its kind or its end date.
 */
export function isUnchanged(
  seen: readonly Seen[],
  memory: Pick<Docs["ninaMemories"], "_id" | "confirmedAt">
) {
  return Arr.some(
    seen,
    (note) => note.id === memory._id && note.confirmedAt === memory.confirmedAt
  );
}
