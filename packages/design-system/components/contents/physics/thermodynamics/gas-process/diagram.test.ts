// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  axesFor,
  axisTicks,
  endAt,
  endStep,
  isothermStates,
  pathStates,
  SAMPLES,
  settleEnd,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/diagram";
import {
  endState,
  MONATOMIC_GAMMA,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";

const AXES = {
  pressure: { maximum: 400, step: 100 },
  volume: { maximum: 25, step: 5 },
};
const START = { pressure: 100, temperature: 300, volume: 10 };

describe("the axes", () => {
  it("runs each axis from zero past its largest state in nice steps", () => {
    expect(
      axesFor([START, { pressure: 317.5, temperature: 190, volume: 20 }], 5)
    ).toEqual(AXES);
    expect(
      axesFor([{ pressure: 9, temperature: 300, volume: 0.27 }], 5)
    ).toEqual({
      pressure: { maximum: 10, step: 2 },
      volume: { maximum: 0.3, step: 0.1 },
    });
  });

  it("marks every step from zero, clear of float error", () => {
    expect(axisTicks(AXES.volume)).toEqual([0, 5, 10, 15, 20, 25]);
    expect(axisTicks({ maximum: 0.3, step: 0.1 })).toEqual([0, 0.1, 0.2, 0.3]);
  });
});

describe("setting the end", () => {
  it("steps an end in about a fiftieth of its range, on a 1, 2 or 5", () => {
    expect(endStep({ end: 0, max: 50, min: 0 })).toBe(1);
    expect(endStep({ end: 0, max: 75, min: 0 })).toBe(2);
    expect(endStep({ end: 0, max: 200, min: 0 })).toBe(5);
    expect(endStep({ end: 0, max: 350, min: 0 })).toBe(10);
  });

  it("holds an end on its step and in its range", () => {
    const range = { end: 15, max: 20, min: 5 };
    expect(settleEnd(range, 12.34)).toBe(12.5);
    expect(settleEnd(range, 2)).toBe(5);
    expect(settleEnd(range, 30)).toBe(20);
  });

  it("reads the volume across a press, or the pressure up it for an isochoric process", () => {
    const spot = { x: 0.6, y: 0.375 };
    expect(endAt("isobaric", { end: 15, max: 20, min: 5 }, AXES, spot)).toBe(
      15
    );
    expect(
      endAt("isochoric", { end: 160, max: 200, min: 40 }, AXES, spot)
    ).toBe(150);
  });
});

describe("the path and the isotherms", () => {
  const end = endState("isothermal", START, 20, MONATOMIC_GAMMA);

  it("samples the path evenly, as far along as the play has come", () => {
    const whole = pathStates("isothermal", { end, start: START }, 5 / 3, 4, 1);
    expect(whole).toHaveLength(5);
    expect(whole[4]?.volume).toBe(20);
    const half = pathStates("isothermal", { end, start: START }, 5 / 3, 4, 0.5);
    expect(half[4]?.volume).toBe(15);
    expect(SAMPLES % 2).toBe(0);
  });

  it("draws an isotherm from the plot's top to its right edge, keeping p V", () => {
    const states = isothermStates(START, AXES, 8);
    expect(states).toHaveLength(9);
    expect(states[0]?.pressure).toBeCloseTo(AXES.pressure.maximum, 9);
    expect(states[8]?.volume).toBeCloseTo(AXES.volume.maximum, 9);
    expect(states[8]?.pressure).toBeCloseTo(40, 9);
    expect(
      isothermStates({ pressure: 400, temperature: 900, volume: 30 }, AXES, 8)
    ).toEqual([]);
  });
});
