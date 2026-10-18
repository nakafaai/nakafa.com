// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  formatInterval,
  intervalOf,
  intervalSeparator,
} from "@repo/design-system/components/contents/mathematics/interval";

describe("intervals", () => {
  it("finds the smallest and the largest of some numbers", () => {
    expect(intervalOf([3, -1.5, 2])).toEqual({ max: 3, min: -1.5 });
    expect(intervalOf([5])).toEqual({ max: 5, min: 5 });
  });

  it("separates the bounds with a comma, or a semicolon in Indonesian", () => {
    expect(intervalSeparator("id")).toBe("; ");
    expect(intervalSeparator("en")).toBe(", ");
    expect(intervalSeparator("de")).toBe(", ");
  });

  it("writes an interval in brackets with its bounds as math", () => {
    const writeDecimal = (value: number) => value.toString().replace(".", ",");

    expect(formatInterval({ max: 3.5, min: -2 }, writeDecimal, ", ")).toBe(
      "[-2, 3{,}5]"
    );
    expect(formatInterval({ max: 4, min: 0.5 }, writeDecimal, "; ")).toBe(
      "[0{,}5; 4]"
    );
  });
});
