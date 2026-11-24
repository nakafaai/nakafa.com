// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  evaluateKey,
  initialSteps,
  testCouplet,
} from "@repo/design-system/components/contents/biology/key/model";
import { Option } from "effect";

const ALL_ANIMALS = [
  "ant",
  "dragonfly",
  "spider",
  "centipede",
  "earthworm",
  "snail",
] as const;

describe("key builder lab model", () => {
  it("sorts all six school animals cleanly with the five diagnostic couplets", () => {
    const steps = initialSteps(ALL_ANIMALS, [
      "legs",
      "pairs",
      "wings",
      "segments",
      "shell",
      "size",
      "colour",
      "overlap",
    ]);
    expect(steps).toEqual(["legs", "pairs", "wings", "segments", "shell"]);

    const result = evaluateKey(ALL_ANIMALS, steps);
    expect(result.allSorted).toBe(true);
    expect(result.reachedCount).toBe(6);
    expect(Option.isNone(result.failedStep)).toBe(true);
  });

  it("detects jamming on overlapping, subjective, or mismatched couplets", () => {
    expect(testCouplet("dragonfly", "overlap")).toBe("both");
    expect(testCouplet("ant", "overlap")).toBe("b");
    expect(testCouplet("snail", "overlap")).toBe("neither");
    expect(testCouplet("ant", "size")).toBe("both");
    expect(testCouplet("ant", "colour")).toBe("both");
    expect(testCouplet("earthworm", "pairs")).toBe("neither");
    expect(testCouplet("ant", "segments")).toBe("neither");

    const jammed = evaluateKey(ALL_ANIMALS, [
      "legs",
      "pairs",
      "overlap",
      "segments",
      "shell",
    ]);
    expect(jammed.allSorted).toBe(false);
    expect(jammed.failedStep).toEqual(Option.some(3));

    const short = evaluateKey(ALL_ANIMALS, ["legs"]);
    expect(short.allSorted).toBe(false);
    expect(short.failedStep).toEqual(Option.some(1));

    const doubleFail = evaluateKey(ALL_ANIMALS, ["legs", "size", "colour"]);
    expect(doubleFail.allSorted).toBe(false);
    expect(doubleFail.failedStep).toEqual(Option.some(2));

    const trivial = evaluateKey(["ant"], ["legs", "wings"]);
    expect(trivial.allSorted).toBe(true);
    expect(trivial.reachedCount).toBe(1);
  });
});
