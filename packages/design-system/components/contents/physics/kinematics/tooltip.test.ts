import { describe, expect, it } from "@effect/vitest";

import { formatTooltipTime } from "@repo/design-system/components/contents/physics/kinematics/tooltip";

describe("formatTooltipTime", () => {
  it("prints the time of the first tooltip item", () => {
    expect(formatTooltipTime("", [{ payload: { time: 2 } }])).toBe("t = 2 s");
  });

  it("falls back to the bare symbol without a numeric time", () => {
    expect(formatTooltipTime("")).toBe("t");
    expect(formatTooltipTime("", [{}])).toBe("t");
    expect(formatTooltipTime("", [{ payload: { time: "2" } }])).toBe("t");
  });
});
