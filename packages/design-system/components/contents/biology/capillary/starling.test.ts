// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { Bed } from "@repo/design-system/components/contents/biology/capillary/starling";
import {
  arterialRange,
  capillaryPressure,
  DAILY,
  exchange,
  flux,
  leaving,
  leftover,
  lymphShare,
  netPressure,
  oncoticRange,
  permeability,
  RISE,
  returning,
  swelling,
  TEXTBOOK,
  turning,
} from "@repo/design-system/components/contents/biology/capillary/starling";

/** Guyton and Hall's loose tissue under the skin, 13th ed., Chapter 16. */
const SUBCUTANEOUS: Bed = {
  arterial: 30,
  oncotic: 28,
  tissue: { oncotic: 8, pressure: -3 },
  venous: 10,
};

/** The textbook bed with too little plasma protein, as in kwashiorkor. */
const STARVED: Bed = { ...TEXTBOOK, oncotic: 12 };

/** The most fluid the lab's sliders can leave: the highest blood pressure against the weakest pull. */
const WORST: Bed = { ...TEXTBOOK, arterial: 60, oncotic: 10 };

describe("the Starling relation along a capillary", () => {
  it("filters with 10 mmHg at the arterial end and takes back with 7 at the venous end", () => {
    expect(capillaryPressure(TEXTBOOK, 0)).toBe(35);
    expect(capillaryPressure(TEXTBOOK, 1)).toBe(18);
    expect(netPressure(TEXTBOOK, 0)).toBe(10);
    expect(netPressure(TEXTBOOK, 1)).toBe(-7);
    expect(turning(TEXTBOOK)).toBeCloseTo(10 / 17, 12);
    expect(netPressure(TEXTBOOK, turning(TEXTBOOK))).toBeCloseTo(0, 12);
  });

  it("adds the tissue fluid's push and pull: 13 mmHg out and 7 in under the skin", () => {
    expect(netPressure(SUBCUTANEOUS, 0)).toBe(13);
    expect(netPressure(SUBCUTANEOUS, 1)).toBe(-7);
    expect(turning(SUBCUTANEOUS)).toBeCloseTo(0.65, 12);
  });

  it("takes back 20.4 of every 24 parts filtered, as the whole body does in a day", () => {
    const { filtered, reabsorbed } = exchange(TEXTBOOK);
    expect(reabsorbed / filtered).toBeCloseTo(
      DAILY.reabsorbed / DAILY.filtered,
      12
    );
    expect(lymphShare(TEXTBOOK)).toBeCloseTo(0.15, 12);
    expect(RISE).toBeGreaterThan(0);
    expect(permeability(0)).toBe(1);
    expect(permeability(1)).toBe(1 + RISE);
    expect(flux(TEXTBOOK, 0)).toBe(10);
    expect(flux(TEXTBOOK, 1)).toBeCloseTo(-7 * (1 + RISE), 12);
  });
});

describe("tissue fluid and oedema", () => {
  it("leaves more fluid in the tissue when the blood pressure rises", () => {
    const high = { ...TEXTBOOK, arterial: 45 };
    expect(lymphShare(high)).toBeGreaterThan(lymphShare(TEXTBOOK));
    expect(leftover(high)).toBeGreaterThan(leftover(TEXTBOOK));
    expect(swelling(high, WORST)).toBeGreaterThan(0);
  });

  it("filters all along and takes nothing back when plasma protein falls", () => {
    expect(netPressure(STARVED, 1)).toBe(6);
    expect(turning(STARVED)).toBe(1);
    expect(exchange(STARVED).reabsorbed).toBeCloseTo(0, 12);
    expect(lymphShare(STARVED)).toBeCloseTo(1, 12);
    expect(swelling(STARVED, WORST)).toBeGreaterThan(0.5);
  });

  it("takes fluid back all along and leaves none when the blood pressure is below the protein pull", () => {
    const low = { ...TEXTBOOK, arterial: 20 };
    expect(turning(low)).toBe(0);
    expect(exchange(low).filtered).toBeCloseTo(0, 12);
    expect(lymphShare(low)).toBe(0);
    expect(leftover(low)).toBe(0);
    expect(swelling(low, WORST)).toBe(0);
  });

  it("leaves nothing for the lymph when the capillary takes back more than it filtered", () => {
    const pulling = { ...TEXTBOOK, arterial: 27, venous: 0 };
    const { filtered, reabsorbed } = exchange(pulling);
    expect(filtered).toBeGreaterThan(0);
    expect(reabsorbed).toBeGreaterThan(filtered);
    expect(lymphShare(pulling)).toBe(0);
    expect(leftover(pulling)).toBe(0);
  });

  it("swells from nothing at the textbook bed to fully at the sliders' worst", () => {
    expect(swelling(TEXTBOOK, WORST)).toBe(0);
    expect(swelling(WORST, WORST)).toBe(1);
    expect(swelling(WORST, TEXTBOOK)).toBe(0);
  });
});

describe("where the fluid crosses the wall", () => {
  it("spreads the leaving fluid over the arterial stretch, densest where it filters most", () => {
    const end = turning(TEXTBOOK);
    expect(leaving(TEXTBOOK, 0)).toBeCloseTo(0, 6);
    expect(leaving(TEXTBOOK, 1)).toBeCloseTo(end, 6);
    const half = leaving(TEXTBOOK, 0.5);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(end / 2);
  });

  it("spreads the returning fluid over the venous stretch", () => {
    const start = turning(TEXTBOOK);
    expect(returning(TEXTBOOK, 0)).toBeCloseTo(start, 6);
    expect(returning(TEXTBOOK, 1)).toBeCloseTo(1, 6);
    const half = returning(TEXTBOOK, 0.5);
    expect(half).toBeGreaterThan(start);
    expect(half).toBeLessThan(1);
  });
});

describe("the sliders", () => {
  it("span 20 to 60 mmHg of blood pressure, above the venous end", () => {
    expect(arterialRange(TEXTBOOK)).toEqual({ max: 60, min: 20 });
    expect(arterialRange({ ...TEXTBOOK, arterial: 70, venous: 30 })).toEqual({
      max: 70,
      min: 31,
    });
    expect(arterialRange({ ...TEXTBOOK, arterial: 15, venous: 5 })).toEqual({
      max: 60,
      min: 15,
    });
  });

  it("span 10 to 35 mmHg of protein pull, widened to hold the bed's own", () => {
    expect(oncoticRange(TEXTBOOK)).toEqual({ max: 35, min: 10 });
    expect(oncoticRange({ ...TEXTBOOK, oncotic: 40 })).toEqual({
      max: 40,
      min: 10,
    });
    expect(oncoticRange({ ...TEXTBOOK, oncotic: 8 })).toEqual({
      max: 35,
      min: 8,
    });
  });
});
