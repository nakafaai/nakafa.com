import { describe, expect, it } from "@effect/vitest";
import { progressPercent } from "@/components/tenant/home/progress";

describe("tenant home progress", () => {
  it("reads the share of a span that has passed, as a whole percent", () => {
    expect(progressPercent(0, 100, 50)).toBe(50);
    expect(progressPercent(0, 3, 1)).toBe(33);
  });

  it("stops at the ends of the span", () => {
    expect(progressPercent(0, 100, -10)).toBe(0);
    expect(progressPercent(0, 100, 200)).toBe(100);
  });

  it("reads a span with no length as done once its end has come", () => {
    expect(progressPercent(10, 10, 9)).toBe(0);
    expect(progressPercent(10, 10, 10)).toBe(100);
  });
});
