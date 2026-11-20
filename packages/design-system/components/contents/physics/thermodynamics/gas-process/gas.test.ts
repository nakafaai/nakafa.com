// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type {
  GasProcessSetup,
  GasState,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import {
  endQuantity,
  endState,
  energyOf,
  energyScale,
  MONATOMIC_GAMMA,
  rangeOf,
  reachableStates,
  startState,
  stateAlong,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";

const R = 8.314;
const MOLES = 0.5;
/** Half a mole at 300 K in 10 L: n R = 4.157 J/K, so p = 124.71 kPa. */
const START = startState(MOLES, { temperature: 300, volume: 10 });

/** Whether a state keeps p V = n R T, kPa times L being joules. */
function idealGas(state: GasState) {
  expect(state.pressure * state.volume).toBeCloseTo(
    MOLES * R * state.temperature,
    9
  );
}

describe("the start state", () => {
  it("finds the pressure from the temperature, or the temperature from the pressure", () => {
    expect(START.pressure).toBeCloseTo(124.71, 9);
    idealGas(START);
    const fromPressure = startState(MOLES, { pressure: 124.71, volume: 10 });
    expect(fromPressure.temperature).toBeCloseTo(300, 9);
    idealGas(fromPressure);
  });
});

describe("the four processes", () => {
  it("keeps the pressure in an isobaric process, where W = p ΔV", () => {
    const end = endState("isobaric", START, 15, MONATOMIC_GAMMA);
    idealGas(end);
    expect(end.pressure).toBe(START.pressure);
    expect(end.temperature).toBeCloseTo(450, 9);
    const energy = energyOf("isobaric", START, end, MONATOMIC_GAMMA);
    expect(energy.work).toBeCloseTo(124.71 * 5, 9);
    expect(energy.internal).toBeCloseTo(1.5 * MOLES * R * 150, 9);
    expect(energy.heat).toBeCloseTo(2.5 * MOLES * R * 150, 9);
  });

  it("does no work in an isochoric process, so ΔU = Q", () => {
    const end = endState("isochoric", START, 2 * START.pressure, 5 / 3);
    idealGas(end);
    expect(end.volume).toBe(10);
    expect(end.temperature).toBeCloseTo(600, 9);
    const energy = energyOf("isochoric", START, end, MONATOMIC_GAMMA);
    expect(energy.work).toBe(0);
    expect(energy.internal).toBeCloseTo(1.5 * MOLES * R * 300, 9);
    expect(energy.heat).toBe(energy.internal);
  });

  it("keeps the temperature in an isothermal process, so ΔU = 0 and Q = W = nRT ln(V2/V1)", () => {
    const end = endState("isothermal", START, 20, MONATOMIC_GAMMA);
    idealGas(end);
    expect(end.temperature).toBe(300);
    expect(end.pressure).toBeCloseTo(START.pressure / 2, 9);
    const energy = energyOf("isothermal", START, end, MONATOMIC_GAMMA);
    expect(energy.internal).toBe(0);
    expect(energy.work).toBeCloseTo(MOLES * R * 300 * Math.log(2), 9);
    expect(energy.heat).toBe(energy.work);
  });

  it("lets no heat into an adiabatic process, so ΔU = −W, keeping p V^γ", () => {
    const end = endState("adiabatic", START, 20, MONATOMIC_GAMMA);
    idealGas(end);
    expect(end.pressure * 20 ** MONATOMIC_GAMMA).toBeCloseTo(
      START.pressure * 10 ** MONATOMIC_GAMMA,
      6
    );
    expect(end.temperature).toBeCloseTo(300 * 0.5 ** (2 / 3), 9);
    const energy = energyOf("adiabatic", START, end, MONATOMIC_GAMMA);
    expect(energy.heat).toBe(0);
    expect(energy.work).toBe(-energy.internal);
    expect(energy.work).toBeCloseTo(
      (START.pressure * 10 - end.pressure * 20) / (MONATOMIC_GAMMA - 1),
      9
    );
    expect(energy.work).toBeGreaterThan(0);
    expect(energy.internal).toBeCloseTo(
      1.5 * MOLES * R * (end.temperature - 300),
      9
    );
  });

  it("keeps ΔU = Q − W both ways, and counts ΔU with the gas's own γ", () => {
    for (const [process, end] of [
      ["isobaric", 6],
      ["isochoric", 80],
      ["isothermal", 4],
      ["adiabatic", 5],
    ] as const) {
      const state = endState(process, START, end, MONATOMIC_GAMMA);
      const energy = energyOf(process, START, state, MONATOMIC_GAMMA);
      expect(energy.internal).toBeCloseTo(energy.heat - energy.work, 9);
    }
    const diatomic = endState("isochoric", START, 2 * START.pressure, 1.4);
    expect(energyOf("isochoric", START, diatomic, 1.4).internal).toBeCloseTo(
      2.5 * MOLES * R * 300,
      9
    );
  });
});

describe("moving along a process", () => {
  it("changes the end quantity evenly from the start to the end", () => {
    expect(endQuantity("isochoric")).toBe("pressure");
    expect(endQuantity("adiabatic")).toBe("volume");
    const end = endState("isochoric", START, 200, MONATOMIC_GAMMA);
    expect(stateAlong("isochoric", START, end, MONATOMIC_GAMMA, 0)).toEqual(
      START
    );
    expect(
      stateAlong("isochoric", START, end, MONATOMIC_GAMMA, 0.5).pressure
    ).toBeCloseTo((START.pressure + 200) / 2, 9);
    const far = endState("adiabatic", START, 16, MONATOMIC_GAMMA);
    const along = stateAlong("adiabatic", START, far, MONATOMIC_GAMMA, 1);
    expect(along.pressure).toBeCloseTo(far.pressure, 9);
  });
});

describe("the offered processes together", () => {
  const isothermal: GasProcessSetup = {
    process: "isothermal",
    volume: { end: 20, max: 20, min: 5 },
  };
  const isochoric: GasProcessSetup = {
    pressure: { end: 200, max: 250, min: 50 },
    process: "isochoric",
  };
  const setups = [isothermal, isochoric];

  it("reads each range and the states at its ends", () => {
    expect(rangeOf(isothermal)).toEqual({ end: 20, max: 20, min: 5 });
    expect(rangeOf(isochoric).max).toBe(250);
    const states = reachableStates(setups, START, MONATOMIC_GAMMA);
    expect(states).toHaveLength(5);
    expect(states[0]).toBe(START);
    expect(states[2]?.volume).toBe(20);
    expect(states[4]?.pressure).toBe(250);
  });

  it("scales every bar to the largest energy any process reaches", () => {
    const isochoricMost = 1.5 * 10 * (250 - START.pressure);
    expect(energyScale(setups, START, MONATOMIC_GAMMA)).toBeCloseTo(
      isochoricMost,
      9
    );
    expect(energyScale([isothermal], START, MONATOMIC_GAMMA)).toBeCloseTo(
      MOLES * R * 300 * Math.log(2),
      9
    );
  });
});
