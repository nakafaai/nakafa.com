// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  ease,
  progress,
  RUN_SECONDS,
  RUN_TRIALS,
  runMoment,
  SLOW_TRIALS,
  TRIAL_SECONDS,
} from "@repo/design-system/components/contents/mathematics/marble/run";
import { Option } from "effect";

describe("the marble run's clock", () => {
  it("plays the first trials marble by marble", () => {
    expect(runMoment(0)).toEqual({
      active: Option.some({ elapsed: 0, trial: 0 }),
      finished: 0,
    });
    const moment = runMoment(TRIAL_SECONDS * 2 + 1);
    expect(moment.finished).toBe(2);
    expect(Option.getOrThrow(moment.active).trial).toBe(2);
    expect(Option.getOrThrow(moment.active).elapsed).toBeCloseTo(1);
    expect(runMoment(-1).finished).toBe(0);
  });

  it("then speeds up and stops at the whole run", () => {
    const fast = runMoment(SLOW_TRIALS * TRIAL_SECONDS + 1);
    expect(Option.isNone(fast.active)).toBe(true);
    expect(fast.finished).toBe(SLOW_TRIALS + 40);
    expect(runMoment(RUN_SECONDS).finished).toBe(RUN_TRIALS);
    expect(runMoment(RUN_SECONDS + 10).finished).toBe(RUN_TRIALS);
  });

  it("eases a step in and out, and clamps outside it", () => {
    expect(ease(-1)).toBe(0);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(2)).toBe(1);
    expect(progress(1.5, 1, 2)).toBe(0.5);
  });
});
