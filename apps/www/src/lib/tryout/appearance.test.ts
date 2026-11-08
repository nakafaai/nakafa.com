import { describe, expect, it } from "@effect/vitest";
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Option } from "effect";
import {
  getTryoutPreviewChoiceTone,
  getTryoutReviewedChoiceTone,
  getTryoutToneMark,
} from "@/lib/tryout/appearance";

describe("getTryoutReviewedChoiceTone", () => {
  it.each([
    [false, false, "idle"],
    [true, false, "wrong"],
    [true, undefined, "wrong"],
    [false, true, "key"],
    [true, true, "correct"],
  ] as const)(
    "maps checked=%s correct=%s to %s",
    (checked, isCorrect, expected) => {
      expect(getTryoutReviewedChoiceTone({ checked, isCorrect })).toBe(
        expected
      );
    }
  );
});

describe("getTryoutPreviewChoiceTone", () => {
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
      expect(getTryoutPreviewChoiceTone({ appearance, checked })).toBe(
        expected
      );
    }
  );
});

describe("getTryoutToneMark", () => {
  it("checks the key picked or not, crosses a pick that misses it, and marks nothing open", () => {
    expect(getTryoutToneMark("correct")).toEqual(Option.some(Tick02Icon));
    expect(getTryoutToneMark("key")).toEqual(Option.some(Tick02Icon));
    expect(getTryoutToneMark("wrong")).toEqual(Option.some(Cancel01Icon));
    expect(getTryoutToneMark("idle")).toEqual(Option.none());
    expect(getTryoutToneMark("chosen")).toEqual(Option.none());
  });
});
