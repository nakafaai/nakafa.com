import { Array as Arr, Option } from "effect";

/**
 * The index of the page at the top of the canvas: the last page whose top has reached `line`
 * pixels below the canvas's top edge. Before the first page reaches the line, the first page is
 * the one in view, so the position always names a page of the exam.
 */
export const pageAt = (tops: readonly number[], line: number): number =>
  Option.getOrElse(
    Arr.findLastIndex(tops, (top) => top <= line),
    () => 0
  );
