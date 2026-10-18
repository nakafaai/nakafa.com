import { describe, expect, it } from "@effect/vitest";
import {
  getCos,
  getQuadrant,
  getRadians,
  getSin,
  getTan,
} from "@repo/math/angles";
import { Option } from "effect";

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

  it("names the quadrant of an angle's terminal side, after any number of turns", () => {
    expect(getQuadrant(30)).toEqual(Option.some(1));
    expect(getQuadrant(135)).toEqual(Option.some(2));
    expect(getQuadrant(200)).toEqual(Option.some(3));
    expect(getQuadrant(-30)).toEqual(Option.some(4));
    expect(getQuadrant(390)).toEqual(Option.some(1));
  });

  it("gives no quadrant to an angle whose side lies on an axis", () => {
    expect(getQuadrant(0)).toEqual(Option.none());
    expect(getQuadrant(90)).toEqual(Option.none());
    expect(getQuadrant(-270)).toEqual(Option.none());
  });
});
