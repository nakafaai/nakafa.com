// @vitest-environment node
import {
  getCos,
  getRadians,
  getSin,
  getTan,
  getTrigonometricReadout,
} from "@repo/design-system/lib/geometry/angles";
import { describe, expect, it } from "vitest";

describe("math degree helpers", () => {
  it("converts degrees to radians", () => {
    expect(getRadians(180)).toBe(Math.PI);
  });

  it("evaluates trigonometry from degree measures", () => {
    expect(getSin(90)).toBeCloseTo(1, 12);
    expect(getCos(180)).toBeCloseTo(-1, 12);
  });

  it("returns finite tangent values when cosine is not near zero", () => {
    expect(getTan(45)).toBeCloseTo(1, 12);
  });

  it("returns infinity when tangent is undefined on the rendered grid", () => {
    expect(getTan(90)).toBe(Number.POSITIVE_INFINITY);
  });

  it("formats the shared interactive trigonometry readout", () => {
    expect(getTrigonometricReadout(30)).toEqual({
      cos: "0.87",
      sin: "0.50",
      tan: "0.58",
    });
    expect(getTrigonometricReadout(90)).toEqual({
      cos: "0.00",
      sin: "1.00",
      tan: undefined,
    });
  });

  it("preserves authored exact trigonometry values", () => {
    expect(
      getTrigonometricReadout(30, {
        cos: "sqrt(3)/2",
        sin: "1/2",
        tan: "1/sqrt(3)",
      })
    ).toEqual({
      cos: "sqrt(3)/2",
      sin: "1/2",
      tan: "1/sqrt(3)",
    });
  });
});
