import type { ContentTreeChild } from "@nakafa/aksara-contracts/tree";
import { Array as Arr, Option, Result } from "effect";

/**
 * The top-level blocks of a body before which an ad frame stands. A body holds
 * at most two frames: one after its second section, before the third heading,
 * and one before its last section. Each stands before a heading, so content
 * always follows a frame and none sits above the previous and next links. A body
 * with three sections holds one frame, where both places meet, and a body with
 * two holds the one before its last section. A body with one section or none
 * holds no frame, so a short page never opens on an ad.
 */
export function adSlotIndices(
  blocks: readonly ContentTreeChild[]
): readonly number[] {
  const headings = Arr.filterMap(blocks, (block, index) =>
    typeof block !== "string" && block.name === "h2"
      ? Result.succeed(index)
      : Result.failVoid
  );
  const beforeLast =
    headings.length < 2 ? Option.none<number>() : Arr.last(headings);
  return Arr.dedupe(Arr.getSomes([Arr.get(headings, 2), beforeLast]));
}
