// @vitest-environment node
import {
  getCos,
  getRadians,
  getSin,
  getTan,
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
});
