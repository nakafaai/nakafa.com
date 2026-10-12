import type { Row } from "@repo/backend/test/judgment/label";
import { outsideNotes } from "@repo/backend/test/judgment/outside";
import { ownNotes } from "@repo/backend/test/judgment/own";
import { secretNotes } from "@repo/backend/test/judgment/secret";
import type { Array as Arr } from "effect";

/**
 * The notes `ownNote` and `private` are measured against (`judgment:measure`):
 * 85 notes in 17 languages and 8 scripts, asked together about up to three at a
 * time as the capture asks them. The notes the learner could write for
 * themself come first, then those that describe the learner from the outside,
 * then those that hold private data. The number of a note is its position in
 * this list, counted from 1, and it is the only thing the command prints about
 * a note.
 */
export const notes: Arr.NonEmptyReadonlyArray<Row> = [
  ...ownNotes,
  ...outsideNotes,
  ...secretNotes,
];
