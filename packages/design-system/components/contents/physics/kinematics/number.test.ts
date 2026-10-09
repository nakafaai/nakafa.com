import { describe, expect, it } from "@effect/vitest";

import {
  formatKeptZeroNumber,
  formatSignedKeptZeroNumber,
  formatSignedTrimmedNumber,
  formatTrimmedNumber,
} from "@repo/design-system/components/contents/physics/kinematics/number";

describe("formatKeptZeroNumber", () => {
  it("keeps the zero tenth of a fraction and writes whole numbers as they are", () => {
    expect(formatKeptZeroNumber(2.04)).toBe("2.0");
    expect(formatKeptZeroNumber(2)).toBe("2");
    expect(formatKeptZeroNumber(-2.5)).toBe("-2.5");
  });
});

describe("formatSignedKeptZeroNumber", () => {
  it("adds a plus sign to a positive value and keeps the minus sign of a negative one", () => {
    expect(formatSignedKeptZeroNumber(2.04)).toBe("+2.0");
    expect(formatSignedKeptZeroNumber(3)).toBe("+3");
    expect(formatSignedKeptZeroNumber(-2.5)).toBe("-2.5");
  });
});

describe("formatTrimmedNumber", () => {
  it("drops the zero tenth, where the kept-zero rule prints it", () => {
    expect(formatTrimmedNumber(2.04)).toBe("2");
    expect(formatTrimmedNumber(2)).toBe("2");
    expect(formatTrimmedNumber(2.5)).toBe("2.5");
    expect(formatTrimmedNumber(-0.04)).toBe("-0");
  });

  it("writes a comma separator as {,}", () => {
    expect(formatTrimmedNumber(2.5, "comma")).toBe("2{,}5");
    expect(formatTrimmedNumber(2, "comma")).toBe("2");
    expect(formatTrimmedNumber(2.5, "dot")).toBe("2.5");
  });
});

describe("formatSignedTrimmedNumber", () => {
  it("prints zero without a sign, a positive value with a plus, and a negative value with its minus", () => {
    expect(formatSignedTrimmedNumber(0)).toBe("0");
    expect(formatSignedTrimmedNumber(2.04)).toBe("+2");
    expect(formatSignedTrimmedNumber(-2.04)).toBe("-2");
  });
});
