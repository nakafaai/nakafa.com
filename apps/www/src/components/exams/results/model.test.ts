import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  correctShare,
  optionLetter,
  responseText,
  verdictKeys,
} from "@/components/exams/results/model";

describe("components/exams/results model", () => {
  it("names each verdict with its own copy key", () => {
    expect(verdictKeys).toEqual({
      correct: "verdict-correct",
      incorrect: "verdict-incorrect",
      partial: "verdict-partial",
      pending: "verdict-pending",
    });
  });

  it("names the options of a choice by letter, from A", () => {
    expect(Arr.map([0, 1, 3], optionLetter)).toEqual(["A", "B", "D"]);
  });

  it("shows the letters of the chosen options in the order of the choice, or the typed text without its spaces", () => {
    const question = {
      optionIds: ["option-1", "option-2", "option-3"],
      sourceIds: [],
      targetIds: [],
    };
    expect(responseText(question, ["option-3", "option-1"])).toBe("A, C");
    expect(responseText(question, [])).toBe("");
    expect(responseText(question, { text: "  Jakarta " })).toBe("Jakarta");
  });

  it("shows the pairs of a match by statement number and answer letter, in the order of the statements", () => {
    const question = {
      optionIds: [],
      sourceIds: ["source-1", "source-2", "source-3"],
      targetIds: ["target-1", "target-2"],
    };
    expect(
      responseText(question, {
        pairs: [
          { source: "source-2", target: "target-1" },
          { source: "source-1", target: "target-2" },
          { source: "source-3", target: "target-9" },
        ],
      })
    ).toBe("1-B, 2-A");
    expect(
      responseText(
        { ...question, sourceIds: ["statement-1", "statement-2"] },
        {
          cells: [
            { column: "target-2", statement: "statement-1" },
            { column: "target-1", statement: "statement-2" },
          ],
        }
      )
    ).toBe("1-B, 2-A");
  });

  it("gives the share of answered questions that are correct, rounded to a whole percentage", () => {
    expect(correctShare({ answered: 3, correct: 2 })).toBe(67);
    expect(correctShare({ answered: 4, correct: 4 })).toBe(100);
  });

  it("gives no share before any answer", () => {
    expect(correctShare({ answered: 0, correct: 0 })).toBeNull();
  });
});
