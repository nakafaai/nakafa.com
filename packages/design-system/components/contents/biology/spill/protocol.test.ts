import { describe, expect, it } from "@effect/vitest";
import {
  clampStage,
  INCIDENTS,
  nextStage,
  stageCopy,
  stagesOf,
} from "@repo/design-system/components/contents/biology/spill/protocol";
import { Option } from "effect";

const SAMPLE_STEPS = {
  culture: { alert: "c1", collect: "c4", cover: "c2", soak: "c3" },
  eye: { alert: "e1", help: "e4", open: "e2", rinse: "e3" },
  fire: { extinguish: "f3", gas: "f1", leave: "f4", smother: "f2" },
  glass: { alert: "g1", box: "g3", sweep: "g2" },
  mercury: { air: "m2", clear: "m1", gather: "m3", seal: "m5", sulfur: "m4" },
} as const;

describe("stagesOf", () => {
  it("returns exact ordered stages for every incident", () => {
    expect(stagesOf("eye")).toEqual(["alert", "open", "rinse", "help"]);
    expect(stagesOf("mercury")).toEqual([
      "clear",
      "air",
      "gather",
      "sulfur",
      "seal",
    ]);
    expect(stagesOf("culture")).toEqual(["alert", "cover", "soak", "collect"]);
    expect(stagesOf("glass")).toEqual(["alert", "sweep", "box"]);
    expect(stagesOf("fire")).toEqual(["gas", "smother", "extinguish", "leave"]);
  });
});

describe("clampStage and nextStage", () => {
  it("clamps indices into valid range and wraps cleanly", () => {
    expect(clampStage("glass", -2)).toBe(0);
    expect(clampStage("glass", 9)).toBe(2);
    expect(nextStage("glass", 1)).toBe(2);
    expect(nextStage("glass", 2)).toBe(0);
  });
});

describe("stageCopy", () => {
  it("returns the matching step text in order for every incident", () => {
    for (const incident of INCIDENTS) {
      const stages = stagesOf(incident);
      for (let i = 0; i < stages.length; i += 1) {
        const copy = stageCopy(incident, i, SAMPLE_STEPS);
        expect(Option.isSome(copy)).toBe(true);
      }
    }
    expect(Option.getOrNull(stageCopy("mercury", 3, SAMPLE_STEPS))).toBe("m4");
    expect(Option.getOrNull(stageCopy("fire", 0, SAMPLE_STEPS))).toBe("f1");
    expect(Option.isNone(stageCopy("eye", 0, {}))).toBe(true);
  });
});
