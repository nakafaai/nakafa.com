import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { NinaMemorySeen } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, HashSet } from "effect";

type Seen = typeof NinaMemorySeen.Type;
type Stored = Pick<Docs["ninaMemories"], "_id" | "confirmedAt">;

/**
 * Whether a memory that the capture call read is gone now. The learner removed
 * or cleared it while the model read the message, so what the call knows is out
 * of date and writing from it could bring back what the learner deleted.
 */
export function lostMemory(seen: readonly Seen[], stored: readonly Stored[]) {
  return Arr.some(
    seen,
    ({ id }) => !Arr.some(stored, (memory) => memory._id === id)
  );
}

/**
 * The memories that were confirmed or edited after the capture call read them.
 * What they hold is newer than the message, so the message does not rewrite
 * their words, their kind or their end date.
 */
export function changedSince(seen: readonly Seen[], stored: readonly Stored[]) {
  return HashSet.fromIterable(
    Arr.map(
      Arr.filter(stored, (memory) =>
        Arr.some(
          seen,
          (note) =>
            note.id === memory._id && note.confirmedAt !== memory.confirmedAt
        )
      ),
      (memory) => memory._id
    )
  );
}
