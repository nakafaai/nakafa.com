import { describe, expect, it } from "@effect/vitest";
import {
  canonicalDecimal,
  matchesNumber,
  type NumericEntry,
  type NumericKey,
  numericKeyFits,
} from "@repo/backend/confect/assessment/number";
import { Option } from "effect";

/** A numeric entry that takes decimals only, and one that also takes fractions. */
const decimals: NumericEntry = {
  acceptsFractions: false,
  id: "number",
  kind: "numericEntry",
  label: "Angka",
};
const fractions: NumericEntry = { ...decimals, acceptsFractions: true };

/** The key of three quarters, exactly. */
const threeQuarters: NumericKey = {
  interaction: "number",
  kind: "numericEntry",
  value: "0.75",
};

describe("assessment/number canonicalDecimal", () => {
  it("spells a typed decimal as the key stores it, in any script and with either point", () => {
    expect(canonicalDecimal("0,750")).toEqual(Option.some("0.75"));
    expect(canonicalDecimal("٠٫٥")).toEqual(Option.some("0.5"));
    expect(canonicalDecimal("-12")).toEqual(Option.some("-12"));
    expect(canonicalDecimal("0.0")).toEqual(Option.some("0"));
  });

  it("stands for no value when the text is a fraction, no number, or empty", () => {
    expect(canonicalDecimal("3/4")).toEqual(Option.none());
    expect(canonicalDecimal("tiga")).toEqual(Option.none());
    expect(canonicalDecimal("")).toEqual(Option.none());
  });
});

describe("assessment/number numericKeyFits", () => {
  it("takes a canonical value, alone or with a tolerance the contract allows", () => {
    expect(numericKeyFits(decimals, threeQuarters)).toBe(true);
    expect(
      numericKeyFits(decimals, {
        ...threeQuarters,
        tolerance: { kind: "absolute", value: "0.01" },
      })
    ).toBe(true);
    expect(
      numericKeyFits(decimals, {
        ...threeQuarters,
        tolerance: { kind: "relative", value: "0.1" },
      })
    ).toBe(true);
  });

  it("refuses a value that is not canonical, a relative tolerance of one or more, and one relative to zero", () => {
    expect(numericKeyFits(decimals, { ...threeQuarters, value: "0,75" })).toBe(
      false
    );
    expect(
      numericKeyFits(decimals, {
        ...threeQuarters,
        tolerance: { kind: "relative", value: "1" },
      })
    ).toBe(false);
    expect(
      numericKeyFits(decimals, {
        ...threeQuarters,
        tolerance: { kind: "relative", value: "0.1" },
        value: "0",
      })
    ).toBe(false);
  });
});

describe("assessment/number matchesNumber", () => {
  it("matches the value in any script and with either decimal point", () => {
    expect(matchesNumber(decimals, threeQuarters, "0.75")).toBe(true);
    expect(matchesNumber(decimals, threeQuarters, "0,75")).toBe(true);
    expect(matchesNumber(decimals, threeQuarters, "٠٫٧٥")).toBe(true);
    expect(matchesNumber(decimals, threeQuarters, "0.7")).toBe(false);
    expect(matchesNumber(decimals, threeQuarters, "tiga perempat")).toBe(false);
  });

  it("matches a fraction only when the entry takes fractions", () => {
    expect(matchesNumber(fractions, threeQuarters, "3/4")).toBe(true);
    expect(matchesNumber(fractions, threeQuarters, "6 / 8")).toBe(true);
    expect(matchesNumber(decimals, threeQuarters, "3/4")).toBe(false);
  });

  it("matches within the key's tolerance, and no further", () => {
    const near: NumericKey = {
      ...threeQuarters,
      tolerance: { kind: "absolute", value: "0.01" },
    };
    expect(matchesNumber(decimals, near, "0.76")).toBe(true);
    expect(matchesNumber(decimals, near, "0.77")).toBe(false);
  });
});
