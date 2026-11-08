import { describe, expect, it } from "@effect/vitest";
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Option } from "effect";
import {
  choiceTone,
  getChoiceReviewedTone,
  toneMark,
} from "@/components/player/tone";

describe("getChoiceReviewedTone", () => {
  it.each([
    [false, false, "idle"],
    [true, false, "wrong"],
    [true, undefined, "wrong"],
    [false, true, "key"],
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
    [false, { isCorrect: true, kind: "revealed" }, "key"],
    [true, { isCorrect: true, kind: "revealed" }, "correct"],
  ] as const)(
    "maps checked=%s appearance=%o to %s",
    (checked, appearance, expected) => {
      expect(choiceTone({ appearance, checked })).toBe(expected);
    }
  );
});

describe("toneMark", () => {
  it("checks the key picked or not, crosses a pick that misses it, and marks nothing open", () => {
    expect(toneMark("correct")).toEqual(Option.some(Tick02Icon));
    expect(toneMark("key")).toEqual(Option.some(Tick02Icon));
    expect(toneMark("wrong")).toEqual(Option.some(Cancel01Icon));
    expect(toneMark("idle")).toEqual(Option.none());
    expect(toneMark("chosen")).toEqual(Option.none());
  });
});
