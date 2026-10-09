import { describe, expect, it } from "@effect/vitest";

import {
  formatAccelerationMath,
  formatKeptZeroMeterMath,
  formatRoundedMeterMath,
  formatRoundedSecondMath,
  formatRoundedSpeedMath,
  formatTrimmedFixedMeterMath,
  formatTrimmedFixedSecondMath,
  formatTrimmedFixedSpeedMath,
} from "@repo/design-system/components/contents/physics/kinematics/math";

describe("kinematics meter formatters", () => {
  it("keeps or drops the zero tenth according to the formatter", () => {
    expect(formatKeptZeroMeterMath(2.04)).toBe("2.0\\text{ m}");
    expect(formatTrimmedFixedMeterMath(2.04)).toBe("2\\text{ m}");
    expect(formatTrimmedFixedMeterMath(2.5, "comma")).toBe("2{,}5\\text{ m}");
  });

  it("rounds to a whole number and rounds halves upward", () => {
    expect(formatRoundedMeterMath(2.5)).toBe("3\\text{ m}");
    expect(formatRoundedMeterMath(-2.5)).toBe("-2\\text{ m}");
  });
});

describe("kinematics speed and time formatters", () => {
  it("writes the unit after the value with the zero tenth dropped", () => {
    expect(formatTrimmedFixedSpeedMath(12.5, "dot")).toBe("12.5\\text{ m/s}");
    expect(formatTrimmedFixedSecondMath(3, "comma")).toBe("3\\text{ s}");
  });

  it("rounds speed and time to a whole number", () => {
    expect(formatRoundedSpeedMath(12.4)).toBe("12\\text{ m/s}");
    expect(formatRoundedSecondMath(0.5)).toBe("1\\text{ s}");
  });
});

describe("formatAccelerationMath", () => {
  it("writes an acceleration with its sign and without a zero tenth", () => {
    expect(formatAccelerationMath(2.04)).toBe("+2\\text{ m/s}^2");
    expect(formatAccelerationMath(-2.04)).toBe("-2\\text{ m/s}^2");
    expect(formatAccelerationMath(0)).toBe("0\\text{ m/s}^2");
  });
});
