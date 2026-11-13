// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  CASEIN_GEL_PH,
  cellsAfter,
  cycleProgress,
  GEL_HOURS,
  generationsAfter,
  hueOf,
  isSet,
  keepsViolet,
  MILK_PH,
  phAfter,
  runLength,
  SWIM,
  stainOf,
  stepSwimmer,
  TUMBLE_TURN,
} from "@repo/design-system/components/contents/biology/bacteria/microbe";

describe("Gram stain", () => {
  it("colours every cell violet, then lets alcohol tell the walls apart", () => {
    expect(stainOf("positive", "violet")).toBe(stainOf("negative", "violet"));
    expect(keepsViolet("negative", "iodine")).toBe(true);
    expect(keepsViolet("negative", "alcohol")).toBe(false);
    expect(keepsViolet("positive", "safranin")).toBe(true);
    expect(keepsViolet("positive", "smear")).toBe(false);
    expect(stainOf("negative", "safranin")).not.toBe(
      stainOf("positive", "safranin")
    );
    expect(hueOf("negative", "smear")).toBe("clear");
    expect(hueOf("negative", "alcohol")).toBe("clear");
    expect(hueOf("negative", "safranin")).toBe("pink");
    expect(hueOf("positive", "safranin")).toBe("purple");
  });
});

describe("binary fission", () => {
  it("doubles every twenty minutes", () => {
    expect(cellsAfter(0)).toBe(1);
    expect(cellsAfter(19)).toBe(1);
    expect(cellsAfter(20)).toBe(2);
    expect(cellsAfter(120)).toBe(64);
    expect(generationsAfter(-5)).toBe(0);
    expect(cycleProgress(30)).toBe(0.5);
    expect(cycleProgress(-3)).toBe(0);
  });
});

describe("swimming", () => {
  it("runs longer up a sugar gradient only when it senses it", () => {
    expect(runLength(true, true)).toBe(2 * SWIM.run);
    expect(runLength(false, true)).toBe(SWIM.run);
    expect(runLength(true, false)).toBe(SWIM.run);
  });
});

describe("run and tumble", () => {
  const start = { heading: 0, left: 1, runs: 0, tumbling: false, x: 0, y: 0 };
  const half = () => 0.5;

  it("runs straight at 25 µm/s, then tumbles in place", () => {
    const ran = stepSwimmer(start, 0.4, true, half);
    expect(ran.x).toBeCloseTo(10, 12);
    const ended = stepSwimmer(ran, 0.8, true, half);
    expect(ended.x).toBeCloseTo(25, 12);
    expect(ended.tumbling).toBe(true);
    const still = stepSwimmer(ended, 0.05, true, half);
    expect(still.x).toBe(ended.x);
    expect(still.tumbling).toBe(true);
  });

  it("turns by the tumble angle and runs longer up the gradient when sensing", () => {
    const tumbling = { ...start, left: 0.01, tumbling: true };
    const right = stepSwimmer(tumbling, 0.05, true, () => 0.6);
    expect(right.heading).toBeCloseTo(TUMBLE_TURN * 1.1, 12);
    expect(right.left).toBe(2 * SWIM.run);
    expect(right.runs).toBe(1);
    const left = stepSwimmer(tumbling, 0.05, false, () => 0.2);
    expect(left.heading).toBeCloseTo(-TUMBLE_TURN * 0.7, 12);
    expect(left.left).toBe(SWIM.run);
  });
});

describe("yoghurt", () => {
  it("sets once the pH falls to casein's", () => {
    expect(phAfter(0)).toBeLessThanOrEqual(MILK_PH);
    expect(phAfter(0)).toBeGreaterThan(6.5);
    expect(phAfter(GEL_HOURS)).toBeCloseTo(CASEIN_GEL_PH, 12);
    expect(isSet(GEL_HOURS - 0.5)).toBe(false);
    expect(isSet(GEL_HOURS)).toBe(true);
    expect(phAfter(12)).toBeGreaterThan(4.2);
    expect(phAfter(2)).toBeGreaterThan(phAfter(3));
  });
});
