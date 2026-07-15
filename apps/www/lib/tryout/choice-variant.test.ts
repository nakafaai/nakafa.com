import { describe, expect, it } from "vitest";
import { getTryoutChoiceVariant } from "@/lib/tryout/choice-variant";

describe("getTryoutChoiceVariant", () => {
  it.each([
    [false, undefined, false, "outline"],
    [true, undefined, false, "default-outline"],
    [false, false, true, "outline"],
    [true, false, true, "destructive-outline"],
    [false, true, true, "success-outline"],
    [true, true, true, "success-outline"],
  ] as const)("maps checked=%s correct=%s review=%s to %s", (checked, isCorrect, reviewMode, expected) => {
    expect(getTryoutChoiceVariant({ checked, isCorrect, reviewMode })).toBe(
      expected
    );
  });
});
