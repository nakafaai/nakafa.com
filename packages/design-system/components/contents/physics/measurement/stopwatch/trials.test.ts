import { describe, expect, it } from "@effect/vitest";
import {
  MAX_TRIALS,
  PERIOD,
  PRESS_SPREAD,
  swingAngle,
  TRUE_TIME,
  timingSpread,
  trialMoment,
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

  it("plays a trial three times faster than real time, rests on its reading, and starts again", () => {
    expect(trialMoment(0, 18)).toBe(18);
    expect(trialMoment(2, 18)).toBeCloseTo(6, 12);
    expect(trialMoment(7, 18)).toBe(18);
    expect(trialMoment(9, 18)).toBeCloseTo(3, 12);
  });

  it("releases the bob from its widest swing and brings it back every period", () => {
    expect(swingAngle(0)).toBeCloseTo(0.16, 12);
    expect(swingAngle(PERIOD / 2)).toBeCloseTo(-0.16, 12);
    expect(swingAngle(PERIOD)).toBeCloseTo(0.16, 12);
  });
});
