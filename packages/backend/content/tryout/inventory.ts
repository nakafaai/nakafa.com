import {
  countSectionQuestions,
  type TryoutSection,
  type TryoutSet,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { Array as Arr } from "effect";

/** Returns the visible sections one decoded section list proves. */
function countVisible(sections: readonly TryoutSection[]) {
  return Arr.filter(sections, (section) => section.visibility === "visible")
    .length;
}

/**
 * Proves one signed set's section inventory from the sections in hand.
 *
 * The catalog index, the pinned landing ancestry, and the release reader all
 * decide whether a set's sections are complete, so the rule lives here once and
 * each reader keeps its own failure encoding. A section that is missing,
 * invisible, or short of its question count fails closed for every caller.
 */
export function provesSetInventory(
  set: TryoutSet,
  sections: readonly TryoutSection[]
) {
  return (
    sections.length === set.sectionCount &&
    countSectionQuestions(sections) === set.questionCount &&
    countVisible(sections) === set.visibleSectionCount
  );
}
