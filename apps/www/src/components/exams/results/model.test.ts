import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  correctShare,
  optionLetter,
  responseLetters,
  verdictKeys,
} from "@/components/exams/results/model";

describe("components/exams/results model", () => {
  it("names each verdict with its own copy key", () => {
    expect(verdictKeys).toEqual({
      correct: "verdict-correct",
      incorrect: "verdict-incorrect",
      pending: "verdict-pending",
    });
  });

  it("names the options of a choice by letter, from A", () => {
    expect(Arr.map([0, 1, 3], optionLetter)).toEqual(["A", "B", "D"]);
  });

  it("lists the letters of the chosen options in the order of the choice", () => {
    const optionIds = ["option-1", "option-2", "option-3"];
    expect(responseLetters(optionIds, ["option-3", "option-1"])).toEqual([
      "A",
      "C",
    ]);
    expect(responseLetters(optionIds, [])).toEqual([]);
  });

  it("gives the share of answered questions that are correct, rounded to a whole percentage", () => {
    expect(correctShare({ answered: 3, correct: 2 })).toBe(67);
    expect(correctShare({ answered: 4, correct: 4 })).toBe(100);
  });

  it("gives no share before any answer", () => {
    expect(correctShare({ answered: 0, correct: 0 })).toBeNull();
  });
});
