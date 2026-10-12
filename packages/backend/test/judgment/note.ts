import type { Row } from "@repo/backend/test/judgment/label";
import { outsideNotes } from "@repo/backend/test/judgment/outside";
import { ownNotes } from "@repo/backend/test/judgment/own";
import { secretNotes } from "@repo/backend/test/judgment/secret";
import type { Array as Arr } from "effect";

/**
 * The notes `ownNote` and `private` are measured against (`judgment:measure`):
 * 85 notes in 17 languages and 8 scripts, each asked in a request of its own as
 * the capture asks. The notes the learner could write for themself come first,
 * then those that describe the learner from the outside, then those that hold
 * private data. The number of a note is its position in this list, counted from
 * 1. The command names a note by that number and describes it by its language
 * and its form, and never prints the note.
 */
export const notes: Arr.NonEmptyReadonlyArray<Row> = [
  ...ownNotes,
  ...outsideNotes,
  ...secretNotes,
];
