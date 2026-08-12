import { describe, expect, it } from "vitest";
import {
  getTryoutPreviewChoiceVariant,
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

describe("getTryoutPreviewChoiceVariant", () => {
  it.each([
    [false, { kind: "selectable" }, "outline"],
    [true, { kind: "selectable" }, "default-outline"],
    [false, { isCorrect: false, kind: "revealed" }, "outline"],
    [true, { isCorrect: false, kind: "revealed" }, "destructive-outline"],
    [false, { isCorrect: true, kind: "revealed" }, "success-outline"],
    [true, { isCorrect: true, kind: "revealed" }, "success-outline"],
  ] as const)(
    "maps checked=%s appearance=%o to %s",
    (checked, appearance, expected) => {
      expect(getTryoutPreviewChoiceVariant({ appearance, checked })).toBe(
        expected
      );
    }
  );
});
