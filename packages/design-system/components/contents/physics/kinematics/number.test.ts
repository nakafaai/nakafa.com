import { describe, expect, it } from "@effect/vitest";

import {
  formatKeptZeroNumber,
  formatSignedTrimmedNumber,
  formatTrimmedFixedNumber,
  formatTrimmedNumber,
} from "@repo/design-system/components/contents/physics/kinematics/number";

describe("formatKeptZeroNumber", () => {
  it("keeps the zero tenth of a fraction and writes whole numbers as they are", () => {
    expect(formatKeptZeroNumber(2.04)).toBe("2.0");
    expect(formatKeptZeroNumber(2)).toBe("2");
    expect(formatKeptZeroNumber(-2.5)).toBe("-2.5");
  });
});

describe("formatTrimmedNumber", () => {
  it("drops the zero tenth and writes a comma separator as {,}", () => {
    expect(formatTrimmedNumber(2.04)).toBe("2");
    expect(formatTrimmedNumber(2.5)).toBe("2.5");
    expect(formatTrimmedNumber(2.5, "comma")).toBe("2{,}5");
    expect(formatTrimmedNumber(2, "comma")).toBe("2");
  });

  it("writes a whole number above 2 ** 53 in its shortest form", () => {
    expect(formatTrimmedNumber(2 ** 60)).toBe("1152921504606847000");
  });
});

describe("formatTrimmedFixedNumber", () => {
  it("drops the zero tenth, also from a whole number above 2 ** 53", () => {
    expect(formatTrimmedFixedNumber(2.04)).toBe("2");
    expect(formatTrimmedFixedNumber(2.5, "comma")).toBe("2{,}5");
    expect(formatTrimmedFixedNumber(2 ** 60)).toBe("1152921504606846976");
  });
});

describe("formatSignedTrimmedNumber", () => {
  it("prints zero without a sign, a positive value with a plus, and a negative value with its minus", () => {
    expect(formatSignedTrimmedNumber(0)).toBe("0");
    expect(formatSignedTrimmedNumber(2.04)).toBe("+2");
    expect(formatSignedTrimmedNumber(-2.04)).toBe("-2");
  });
});
