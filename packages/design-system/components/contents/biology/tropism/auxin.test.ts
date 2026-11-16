// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  bend,
  FULL_BEND,
  gravitySplit,
  growth,
  lightSplit,
} from "@repo/design-system/components/contents/biology/tropism/auxin";

describe("phototropism", () => {
  it("bends an intact shoot and a shoot cut on its lit side towards the light", () => {
    expect(bend(lightSplit("intact"), "shoot", 1)).toBeCloseTo(
      0.3 * FULL_BEND,
      12
    );
    expect(bend(lightSplit("micaLit"), "shoot", 1)).toBeCloseTo(
      0.65 * FULL_BEND,
      12
    );
  });

  it("keeps a capped or cut shoot straight, and never bends a shoot blocked on its shaded side towards the light", () => {
    expect(bend(lightSplit("cap"), "shoot", 1)).toBe(0);
    expect(bend(lightSplit("cut"), "shoot", 1)).toBe(0);
    expect(bend(lightSplit("micaShade"), "shoot", 1)).toBeLessThan(0);
  });

  it("lets an organ without auxin barely grow", () => {
    expect(growth(lightSplit("cut"), 1)).toBe(0);
    expect(growth(lightSplit("cap"), 0.5)).toBe(0.5);
    expect(growth(lightSplit("micaShade"), 1)).toBeCloseTo(0.35, 12);
  });
});

describe("gravitropism", () => {
  it("curves a flat shoot up and its root down", () => {
    const split = gravitySplit("flat", "shoot");

    expect(split.near).toBeGreaterThan(split.far);
    expect(bend(split, "shoot", 1)).toBeLessThan(0);
    expect(bend(gravitySplit("flat", "root"), "root", 1)).toBeGreaterThan(0);
  });

  it("keeps both straight on a klinostat, and a decapped root straight", () => {
    expect(bend(gravitySplit("klinostat", "shoot"), "shoot", 1)).toBe(0);
    expect(bend(gravitySplit("decapped", "root"), "root", 1)).toBeCloseTo(
      0,
      12
    );
    expect(bend(gravitySplit("decapped", "shoot"), "shoot", 1)).toBeLessThan(0);
  });
});
