import { describe, expect, it } from "@effect/vitest";
import { stackReading } from "@repo/design-system/components/contents/physics/measurement/paper/stack";

describe("one sheet from a stack of paper", () => {
  it("reads 10 sheets as 1 mm, one significant figure", () => {
    expect(stackReading("10")).toEqual({ figures: 1, height: 1, sheet: 0.0001, sheets: 10 });
  });

  it("reads 100 sheets as 10 mm and 500 as 52 mm, two figures", () => {
    expect(stackReading("100").height).toBe(10);
    expect(stackReading("100").figures).toBe(2);
    expect(stackReading("500").height).toBe(52);
    expect(stackReading("500").sheet).toBeCloseTo(1.04e-4, 12);
  });

  it("reads 1000 sheets as 104 mm, three figures: 1.04 × 10^-4 m a sheet", () => {
    const reading = stackReading("1000");
    expect(reading.height).toBe(104);
    expect(reading.figures).toBe(3);
    expect(reading.sheet).toBeCloseTo(1.04e-4, 12);
  });
});
