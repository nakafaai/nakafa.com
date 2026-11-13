import { describe, expect, it } from "@effect/vitest";
import { unitForm } from "@repo/design-system/components/contents/physics/vector/form";

const format = (value: number) => value.toFixed(0);

describe("unitForm", () => {
  it("writes three components with their signs and the unit after the bracket", () => {
    expect(unitForm([3, -4, 12], format, "\\text{ m}")).toBe(
      "\\left(3\\,\\hat{\\imath}-4\\,\\hat{\\jmath}+12\\,\\hat{k}\\right)\\text{ m}"
    );
  });

  it("leaves out a zero component and needs no bracket for one term", () => {
    expect(unitForm([0, -5], format, "\\text{ N}")).toBe(
      "-5\\,\\hat{\\jmath}\\text{ N}"
    );
  });

  it("writes the zero vector when every component is zero", () => {
    expect(unitForm([0, 0, 0], format, "\\text{ m}")).toBe("\\vec{0}");
  });
});
