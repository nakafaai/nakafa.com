// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  arrowOn,
  axesFor,
  axisTicks,
  bandIndex,
  bandPositions,
  endAt,
  endStep,
  isothermSpots,
  pathStates,
  plotPoint,
  SAMPLES,
  settleEnd,
  spreadApart,
  tagSides,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/diagram";
import {
  endState,
  MONATOMIC_GAMMA,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import { Array as Arr, Option } from "effect";

const PLOT = { height: 0.24, width: 0.3 };
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

  it("marks every step after zero, clear of float error", () => {
    expect(axisTicks(AXES.volume)).toEqual([5, 10, 15, 20, 25]);
    expect(axisTicks({ maximum: 0.3, step: 0.1 })).toEqual([0.1, 0.2, 0.3]);
  });

  it("places a state on the plot by its volume across and pressure up", () => {
    expect(plotPoint({ pressure: 200, volume: 12.5 }, AXES, PLOT)).toEqual({
      x: 0.15,
      y: 0.12,
    });
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
    const spot = { x: 0.18, y: 0.09 };
    expect(
      endAt("isobaric", { end: 15, max: 20, min: 5 }, AXES, PLOT, spot)
    ).toBe(15);
    expect(
      endAt("isochoric", { end: 160, max: 200, min: 40 }, AXES, PLOT, spot)
    ).toBe(150);
  });
});

describe("the path and the band under it", () => {
  const end = endState("isothermal", START, 20, MONATOMIC_GAMMA);

  it("samples the path evenly, as far along as the play has come", () => {
    const whole = pathStates("isothermal", { end, start: START }, 5 / 3, 4, 1);
    expect(whole).toHaveLength(5);
    expect(whole[4]?.volume).toBe(20);
    const half = pathStates("isothermal", { end, start: START }, 5 / 3, 4, 0.5);
    expect(half[4]?.volume).toBe(15);
    expect(SAMPLES % 2).toBe(0);
  });

  it("lays the band from the path down to the volume axis", () => {
    const positions = bandPositions([START, end], AXES, PLOT);
    expect(Arr.fromIterable(positions)).toEqual(
      Arr.fromIterable(
        new Float32Array([0.12, 0.06, 0, 0.12, 0, 0, 0.24, 0.03, 0, 0.24, 0, 0])
      )
    );
    expect(bandIndex(2)).toEqual([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]);
  });

  it("points the arrow halfway along the path, and nowhere on a path of no length", () => {
    const flat = [
      { x: 0, y: 0.1 },
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.1 },
    ];
    expect(arrowOn(flat)).toEqual(Option.some({ angle: 0, x: 0.1, y: 0.1 }));
    const still = Arr.makeBy(3, () => ({ x: 0.1, y: 0.1 }));
    expect(Option.isNone(arrowOn(still))).toBe(true);
    expect(Option.isNone(arrowOn([{ x: 0, y: 0 }]))).toBe(true);
  });
});

describe("the isotherms and the names", () => {
  it("draws an isotherm from the plot's top to its right edge, keeping p V", () => {
    const spots = isothermSpots(START, AXES, PLOT, 8);
    expect(spots).toHaveLength(9);
    expect(spots[0]?.y).toBeCloseTo(PLOT.height, 9);
    expect(spots[8]?.x).toBeCloseTo(PLOT.width, 9);
    expect(spots[8]?.y).toBeCloseTo((40 / 400) * PLOT.height, 9);
    expect(
      isothermSpots(
        { pressure: 400, temperature: 900, volume: 30 },
        AXES,
        PLOT,
        8
      )
    ).toEqual([]);
  });

  it("keeps two names apart about their middle and above the floor", () => {
    const [apartLow, apartHigh] = spreadApart([0.1, 0.2], 0.03, 0.02);
    expect(apartLow).toBeCloseTo(0.1, 9);
    expect(apartHigh).toBeCloseTo(0.2, 9);
    const [low, high] = spreadApart([0.1, 0.11], 0.03, 0.02);
    expect(low).toBeCloseTo(0.09, 9);
    expect(high).toBeCloseTo(0.12, 9);
    const [upper, lower] = spreadApart([0.03, 0.02], 0.03, 0.02);
    expect(lower).toBe(0.02);
    expect(upper).toBeCloseTo(0.05, 9);
  });

  it("names each end on the side away from the path, clear of the isotherms", () => {
    expect(tagSides({ x: 0, y: 0 }, { x: 0.1, y: -0.05 })).toEqual({
      end: 1,
      start: -1,
    });
    expect(tagSides({ x: 0.1, y: 0 }, { x: 0, y: 0 })).toEqual({
      end: -1,
      start: 1,
    });
  });
});
