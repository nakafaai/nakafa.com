import { describe, expect, it } from "@effect/vitest";
import {
  chosenOptions,
  isAnswered,
  madePairs,
  markedCells,
  typedText,
} from "@repo/backend/confect/exams/sittings/response";
import { Array as Arr } from "effect";

/** One response of each shape: options, typed text, pairs and cells. */
const choice = ["option-2"];
const text = { text: "Jakarta" };
const pairs = { pairs: [{ source: "source-1", target: "target-2" }] };
const cells = { cells: [{ column: "column-1", statement: "statement-1" }] };

describe("exams/sittings response", () => {
  it("answers a question with a chosen option, typed text that is not blank, a pair or a marked cell", () => {
    expect(isAnswered(choice)).toBe(true);
    expect(isAnswered(text)).toBe(true);
    expect(isAnswered(pairs)).toBe(true);
    expect(isAnswered(cells)).toBe(true);
  });

  it("leaves a question unanswered with no option, blank text, no pair or no cell", () => {
    expect(isAnswered([])).toBe(false);
    expect(isAnswered({ text: "  " })).toBe(false);
    expect(isAnswered({ pairs: [] })).toBe(false);
    expect(isAnswered({ cells: [] })).toBe(false);
  });

  it("reads the options, the text, the pairs and the cells of their own shape, and none of another", () => {
    expect(chosenOptions(choice)).toEqual(choice);
    expect(Arr.map([text, pairs, cells], chosenOptions)).toEqual([[], [], []]);
    expect(typedText(text)).toBe("Jakarta");
    expect(typedText(choice)).toBe("");
    expect(madePairs(pairs)).toEqual(pairs.pairs);
    expect(madePairs(text)).toEqual([]);
    expect(markedCells(cells)).toEqual(cells.cells);
    expect(markedCells(pairs)).toEqual([]);
  });
});
