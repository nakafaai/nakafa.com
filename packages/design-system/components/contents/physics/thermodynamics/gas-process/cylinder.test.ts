// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  arrowSpan,
  CYLINDER,
  columnHeight,
  MOLECULES,
  moleculePace,
  moleculePlace,
  momentAt,
  PLAY_SECONDS,
  plateGlow,
  playShare,
  temperatureSpan,
  warmth,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/cylinder";
import {
  endState,
  energyOf,
  MONATOMIC_GAMMA,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import { Array as Arr } from "effect";

const START = { pressure: 100, temperature: 300, volume: 10 };

describe("the gas in the cylinder", () => {
  it("stands as tall as its volume, the bore being fixed", () => {
    expect(columnHeight(25, 25)).toBe(CYLINDER.column);
    expect(columnHeight(10, 25)).toBeCloseTo(0.4 * CYLINDER.column, 9);
  });

  it("looks warmer the hotter it is, between the coldest and hottest states", () => {
    const span = temperatureSpan([
      START,
      { ...START, temperature: 600 },
      { ...START, temperature: 200 },
    ]);
    expect(span).toEqual({ high: 600, low: 200 });
    expect(warmth(400, span)).toBe(0.5);
    expect(warmth(100, span)).toBe(0);
    expect(warmth(900, span)).toBe(1);
    expect(warmth(300, { high: 300, low: 300 })).toBe(0.5);
  });

  it("flies its molecules faster as the square root of its temperature", () => {
    expect(moleculePace(1200, 300)).toBe(2);
  });

  it("keeps every molecule inside the bore, between the floor and the piston", () => {
    const half = 0.65 * CYLINDER.radius;
    for (const clock of [0, 0.7, 1.9, 5.3]) {
      for (const index of Arr.range(0, MOLECULES - 1)) {
        const at = moleculePlace(index, clock, 0.12);
        expect(Math.abs(at.x)).toBeLessThanOrEqual(half);
        expect(Math.abs(at.z)).toBeLessThanOrEqual(half);
        expect(at.y).toBeGreaterThanOrEqual(0.005);
        expect(at.y).toBeLessThanOrEqual(0.115);
      }
    }
    expect(moleculePlace(3, 1, 0).y).toBe(0.005);
  });
});

describe("a play along the process", () => {
  it("eases from the start to the end and rests there", () => {
    expect(playShare(-1)).toBe(0);
    expect(playShare(PLAY_SECONDS / 2)).toBe(0.5);
    expect(playShare(PLAY_SECONDS * 2)).toBe(1);
  });

  it("gives the gas's state and energy so far at each moment", () => {
    const end = endState("isobaric", START, 20, MONATOMIC_GAMMA);
    const done = momentAt("isobaric", { end, start: START }, MONATOMIC_GAMMA, {
      playing: true,
      share: 1,
    });
    expect(done.playing).toBe(true);
    expect(done.state.volume).toBe(20);
    expect(done.energy).toEqual(
      energyOf("isobaric", START, end, MONATOMIC_GAMMA)
    );
    const half = momentAt("isobaric", { end, start: START }, MONATOMIC_GAMMA, {
      playing: false,
      share: 0.5,
    });
    expect(half.state.volume).toBe(15);
    expect(half.energy.work).toBeCloseTo(500, 9);
  });
});

describe("the arrows and the plate", () => {
  it("ends the heat arrow at the wall when heat flows in, and starts it there when heat flows out", () => {
    expect(arrowSpan(500, 1000, 0.1, "wall")).toEqual({ from: -0.05, to: 0 });
    expect(arrowSpan(-500, 1000, 0.1, "wall")).toEqual({ from: 0, to: -0.05 });
  });

  it("centres the work arrow on the piston, pointing the way it moves", () => {
    expect(arrowSpan(1000, 1000, 0.1, "middle")).toEqual({
      from: -0.05,
      to: 0.05,
    });
    expect(arrowSpan(-1000, 1000, 0.1, "middle")).toEqual({
      from: 0.05,
      to: -0.05,
    });
  });

  it("keeps a small energy's arrow long enough to see, and draws none for no energy", () => {
    const small = arrowSpan(1, 1000, 0.1, "wall");
    expect(small.to - small.from).toBe(0.014);
    const none = arrowSpan(1e-12, 1000, 0.1, "middle");
    expect(Math.abs(none.to - none.from)).toBe(0);
  });

  it("glows the plate while it heats or cools an isobaric or isochoric gas only", () => {
    expect(plateGlow("isochoric", 500, 1000)).toEqual({
      cold: false,
      strength: 0.7,
    });
    expect(plateGlow("isobaric", -1000, 1000)).toEqual({
      cold: true,
      strength: 1.4,
    });
    expect(plateGlow("isothermal", 500, 1000).strength).toBe(0);
    expect(plateGlow("isobaric", 0, 0).strength).toBe(0);
  });
});
