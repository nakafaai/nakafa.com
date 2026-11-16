import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  createWind,
  gustAt,
  poseOf,
  stepWind,
  WIND_CYCLE,
  WIND_FROM,
  WIND_HEADING,
  WIND_SIDE,
  WIND_SPAN,
} from "@/lib/island/wind";

/** The texel of the lean map over the map's middle, and the ground under it. */
const MIDDLE = (WIND_SIDE / 2) * WIND_SIDE + WIND_SIDE / 2;
const GROUND = WIND_FROM + (WIND_SIDE / 2 + 0.5) * (WIND_SPAN / WIND_SIDE);

/** The second the strongest front, which enters at 21.5 s and runs 7 cells a second, stands over the map's middle. */
const ARRIVAL =
  21.5 + (GROUND * (WIND_HEADING[0] + WIND_HEADING[1])) / 7 - WIND_CYCLE;

/** The lean of the middle's trees at each step of a run of the wind from `from` for `seconds`, at 60 steps a second. */
function swing(
  wind: ReturnType<typeof createWind>,
  from: number,
  seconds: number,
  force: number
) {
  return Arr.makeBy(Math.round(seconds * 60), (step) => {
    stepWind(wind, from + step / 60, 1 / 60, force);
    return wind.lean[MIDDLE];
  });
}

describe("island/wind", () => {
  it("blows the same gusts again every cycle", () => {
    for (const time of [0.4, 7.3, 15.9]) {
      expect(gustAt(120, 90, time + WIND_CYCLE)).toBeCloseTo(
        gustAt(120, 90, time),
        9
      );
    }
  });

  it("brings the strongest front over a place, hardly felt a second and a half before", () => {
    expect(gustAt(GROUND, GROUND, ARRIVAL)).toBeGreaterThan(1.15);
    expect(gustAt(GROUND, GROUND, ARRIVAL - 1.5)).toBeLessThan(0.45);
  });

  it("runs the front down the wind and never against it", () => {
    const ahead = 14;
    const there = [
      GROUND + ahead * WIND_HEADING[0],
      GROUND + ahead * WIND_HEADING[1],
    ] as const;
    expect(gustAt(there[0], there[1], ARRIVAL + ahead / 7)).toBeGreaterThan(
      1.15
    );
    expect(gustAt(there[0], there[1], ARRIVAL - ahead / 7)).toBeLessThan(0.2);
  });

  it("leans a tree as the front passes, swings it back past upright, and brings it to rest", () => {
    const wind = createWind();
    const passing = swing(wind, ARRIVAL - 2, 6, 1);
    expect(Math.max(...passing)).toBeGreaterThan(1.5);
    expect(Math.max(...passing)).toBeLessThan(4);
    expect(Math.min(...passing)).toBeLessThan(-0.1);
    const rest = swing(wind, ARRIVAL + 4, 12, 0);
    expect(
      Math.max(...Arr.map(Arr.takeRight(rest, 30), Math.abs))
    ).toBeLessThan(0.01);
    expect(wind.map[MIDDLE]).toBe(128);
  });

  it("leaves every tree upright in still air, however long a frame took", () => {
    const wind = createWind();
    stepWind(wind, 5, 30, 0);
    stepWind(wind, 6, -1, 0);
    expect(Arr.dedupe(Arr.fromIterable(wind.map))).toEqual([128]);
    expect(Math.max(...wind.lean)).toBe(0);
  });

  it("holds a pose for a tenth of a second", () => {
    expect(poseOf(0.31)).toBe(poseOf(0.39));
    expect(poseOf(0.41)).toBeGreaterThan(poseOf(0.39));
    expect(poseOf(16)).toBeCloseTo(0, 9);
  });
});
