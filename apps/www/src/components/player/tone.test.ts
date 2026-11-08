import { describe, expect, it } from "@effect/vitest";
import { choiceTone, getChoiceReviewedTone } from "@/components/player/tone";

describe("getChoiceReviewedTone", () => {
  it.each([
    [false, false, "idle"],
    [true, false, "wrong"],
    [false, true, "correct"],
    [true, true, "correct"],
  ] as const)(
    "maps checked=%s correct=%s to %s",
    (checked, isCorrect, expected) => {
      expect(getChoiceReviewedTone({ checked, isCorrect })).toBe(expected);
    }
  );
});

describe("choiceTone", () => {
  it.each([
    [false, { kind: "selectable" }, "idle"],
    [true, { kind: "selectable" }, "chosen"],
    [false, { isCorrect: false, kind: "revealed" }, "idle"],
    [true, { isCorrect: false, kind: "revealed" }, "wrong"],
    [false, { isCorrect: true, kind: "revealed" }, "correct"],
    [true, { isCorrect: true, kind: "revealed" }, "correct"],
  ] as const)(
    "maps checked=%s appearance=%o to %s",
    (checked, appearance, expected) => {
      expect(choiceTone({ appearance, checked })).toBe(expected);
    }
  );
});
