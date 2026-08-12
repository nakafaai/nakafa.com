import { describe, expect, it } from "vitest";
import {
  getTryoutReviewedChoiceVariant,
  getTryoutSelectableChoiceVariant,
} from "@/lib/tryout/choice-variant";

describe("getTryoutSelectableChoiceVariant", () => {
  it.each([
    [false, "outline"],
    [true, "default-outline"],
  ] as const)("maps checked=%s to %s", (checked, expected) => {
    expect(getTryoutSelectableChoiceVariant({ checked })).toBe(expected);
  });
});

describe("getTryoutReviewedChoiceVariant", () => {
  it.each([
    [false, false, "outline"],
    [true, false, "destructive-outline"],
    [false, true, "success-outline"],
    [true, true, "success-outline"],
  ] as const)(
    "maps checked=%s correct=%s to %s",
    (checked, isCorrect, expected) => {
      expect(getTryoutReviewedChoiceVariant({ checked, isCorrect })).toBe(
        expected
      );
    }
  );
});
