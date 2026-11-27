import { describe, expect, it } from "@effect/vitest";
import { neutronsOf } from "@repo/design-system/components/three/atom/isotope";

describe("neutronsOf", () => {
  it("answers the most abundant isotope of the light elements", () => {
    expect(neutronsOf(1)).toBe(0);
    expect(neutronsOf(6)).toBe(6);
    expect(neutronsOf(11)).toBe(12);
    expect(neutronsOf(17)).toBe(18);
    expect(neutronsOf(18)).toBe(22);
    expect(neutronsOf(20)).toBe(20);
    expect(neutronsOf(36)).toBe(48);
  });

  it("follows the stable trend past the table and never goes below zero", () => {
    expect(neutronsOf(80)).toBe(120);
    expect(neutronsOf(0)).toBe(0);
    expect(neutronsOf(-3)).toBe(0);
  });
});
