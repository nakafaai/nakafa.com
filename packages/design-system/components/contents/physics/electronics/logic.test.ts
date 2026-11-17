import { describe, expect, it } from "@effect/vitest";
import {
  dividerVoltage,
  gateOutput,
  transistorBias,
} from "@repo/design-system/components/contents/physics/electronics/logic";
import { Array as Arr } from "effect";

/** The four input pairs in truth-table order. */
const PAIRS = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
] as const;

describe("gateOutput", () => {
  it("gives each gate its truth table", () => {
    const table = (gate: "AND" | "OR" | "NAND" | "NOR" | "XOR") =>
      Arr.map(PAIRS, ([a, b]) => gateOutput(gate, a, b));
    expect(table("AND")).toEqual([0, 0, 0, 1]);
    expect(table("OR")).toEqual([0, 1, 1, 1]);
    expect(table("NAND")).toEqual([1, 1, 1, 0]);
    expect(table("NOR")).toEqual([1, 0, 0, 0]);
    expect(table("XOR")).toEqual([0, 1, 1, 0]);
  });

  it("matches the SPM rows when an OR gate feeds a NAND gate with C = 1", () => {
    expect(
      Arr.map(PAIRS, ([a, b]) => gateOutput("NAND", gateOutput("OR", a, b), 1))
    ).toEqual([1, 0, 0, 0]);
  });
});

describe("dividerVoltage", () => {
  it("gives the lower arm the larger share when the upper resistor is smaller", () => {
    expect(dividerVoltage(6, 10, 10)).toBe(3);
    expect(dividerVoltage(6, 5, 10)).toBe(4);
  });
});

describe("transistorBias", () => {
  const circuit = {
    base: 100_000,
    baseSupply: 4.7,
    collector: 1000,
    collectorSupply: 9,
    gain: 100,
    threshold: 0.7,
  };

  it("leaves 5.0 V across the transistor with 40 microamps into the base", () => {
    const bias = transistorBias(circuit);
    expect(bias.baseCurrent).toBeCloseTo(4e-5, 12);
    expect(bias.collectorCurrent).toBeCloseTo(4e-3, 12);
    expect(bias.collectorEmitter).toBeCloseTo(5, 9);
    expect(bias.saturated).toBe(false);
  });

  it("saturates when the base current would ask for more than the collector resistor allows", () => {
    const bias = transistorBias({ ...circuit, base: 10_000 });
    expect(bias.saturated).toBe(true);
    expect(bias.collectorEmitter).toBeCloseTo(0.2, 9);
  });

  it("stays off below the threshold", () => {
    expect(
      transistorBias({ ...circuit, baseSupply: 0.5 }).collectorCurrent
    ).toBe(0);
  });
});
