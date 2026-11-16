import { describe, expect, it } from "@effect/vitest";
import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";

const RUN = { duration: 2, hold: 1, rate: 0.5 };

describe("advanceRun", () => {
  it("advances simulated time at the run's rate", () => {
    expect(advanceRun(0, 0.04, RUN)).toBeCloseTo(0.02);
  });

  it("caps a long frame, so a slow device plays slowed down", () => {
    expect(advanceRun(1, 3, RUN)).toBeCloseTo(1.05);
  });

  it("rests past the end, then starts again from zero", () => {
    expect(advanceRun(2.4, 0.05, RUN)).toBeCloseTo(2.425);
    expect(advanceRun(2.49, 0.05, RUN)).toBe(0);
  });
});

describe("shownTime", () => {
  it("holds the last frame while the run rests", () => {
    expect(shownTime(2.3, 2)).toBe(2);
    expect(shownTime(1.2, 2)).toBe(1.2);
    expect(shownTime(-0.1, 2)).toBe(0);
  });
});
