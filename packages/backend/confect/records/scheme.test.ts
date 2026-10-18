import { describe, expect, it } from "@effect/vitest";
import {
  bandOf,
  DEFAULT_GRADING_SCHEME,
  GradeValue,
  type GradingScheme,
  normalizeScheme,
  reachesKktp,
} from "@repo/backend/confect/records/scheme";
import { Array as Arr, Option, Schema } from "effect";

const scheme: GradingScheme = {
  bands: [
    { label: "A", minimum: 85 },
    { label: "C", minimum: 0 },
    { label: "B", minimum: 70 },
  ],
  kktp: 75,
};

describe("records/scheme normalisation", () => {
  it("orders the bands by their minimum, from the lowest up", () => {
    expect(
      Arr.map(normalizeScheme(scheme).bands, (band) => band.label)
    ).toEqual(["C", "B", "A"]);
  });

  it("keeps a scheme without bands as it is", () => {
    expect(normalizeScheme(DEFAULT_GRADING_SCHEME)).toEqual(
      DEFAULT_GRADING_SCHEME
    );
  });
});

describe("records/scheme KKTP and bands", () => {
  it("reaches the KKTP at its own value, and not below it", () => {
    expect(reachesKktp(DEFAULT_GRADING_SCHEME, 75)).toBe(true);
    expect(reachesKktp(DEFAULT_GRADING_SCHEME, 74.9)).toBe(false);
  });

  it("names the highest band a value reaches, and the lowest band at its own minimum", () => {
    expect(Option.map(bandOf(scheme, 90), (band) => band.label)).toEqual(
      Option.some("A")
    );
    expect(Option.map(bandOf(scheme, 85), (band) => band.label)).toEqual(
      Option.some("A")
    );
    expect(Option.map(bandOf(scheme, 84), (band) => band.label)).toEqual(
      Option.some("B")
    );
    expect(Option.map(bandOf(scheme, 0), (band) => band.label)).toEqual(
      Option.some("C")
    );
  });

  it("names no band for a scheme without bands", () => {
    expect(Option.isNone(bandOf(DEFAULT_GRADING_SCHEME, 90))).toBe(true);
  });

  it("names no band for a value below every band's minimum", () => {
    const high: GradingScheme = {
      bands: [{ label: "A", minimum: 80 }],
      kktp: 75,
    };
    expect(Option.isNone(bandOf(high, 79))).toBe(true);
  });
});

describe("records/scheme grade values", () => {
  it("accepts only values from 0 to 100 on the scale", () => {
    expect(Schema.is(GradeValue)(0)).toBe(true);
    expect(Schema.is(GradeValue)(100)).toBe(true);
    expect(Schema.is(GradeValue)(100.5)).toBe(false);
    expect(Schema.is(GradeValue)(-1)).toBe(false);
  });
});
