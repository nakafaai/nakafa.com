import { describe, expect, it } from "@effect/vitest";
import {
  MAX_TRIALS,
  PERIOD,
  PRESS_SPREAD,
  TRUE_TIME,
  timingSpread,
  trialTimes,
} from "@repo/design-system/components/contents/physics/measurement/stopwatch/trials";
import { Array as Arr } from "effect";

describe("timing a pendulum by hand", () => {
  it("swings an 80 cm pendulum once every 1.79 s, ten swings in 17.94 s", () => {
    expect(PERIOD).toBeCloseTo(1.7943, 4);
    expect(TRUE_TIME).toBeCloseTo(17.943, 3);
  });

  it("gives the same readings on every visit, to the hundredth of a second", () => {
    const times = trialTimes(MAX_TRIALS);
    expect(times).toEqual(trialTimes(MAX_TRIALS));
    expect(Arr.take(times, 5)).toEqual(trialTimes(5));
    for (const time of times) {
      expect(Math.round(time * 100) / 100).toBe(time);
      expect(Math.abs(time - TRUE_TIME)).toBeLessThan(
        5 * PRESS_SPREAD * Math.SQRT2
      );
    }
  });

  it("scatters readings by about the spread of two thumb presses", () => {
    const { mean, spread } = timingSpread(trialTimes(MAX_TRIALS));
    expect(Math.abs(mean - TRUE_TIME)).toBeLessThan(0.08);
    expect(spread).toBeGreaterThan(0.05);
    expect(spread).toBeLessThan(0.2);
  });

  it("shrinks the uncertainty of the mean with the square root of the trials", () => {
    const { spread, uncertainty } = timingSpread(trialTimes(16));
    expect(uncertainty).toBeCloseTo(spread / 4, 12);
  });

  it("has no spread from a single reading", () => {
    expect(timingSpread([17.9])).toEqual({
      mean: 17.9,
      spread: 0,
      uncertainty: 0,
    });
  });
});
