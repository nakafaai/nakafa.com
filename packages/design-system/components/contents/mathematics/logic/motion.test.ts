// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BLADE_SPEED,
  FILAMENT,
  heat,
  swing,
} from "@repo/design-system/components/contents/mathematics/logic/motion";

describe("moving parts", () => {
  it("warms the filament to full glow and cools it to dark, never past either", () => {
    expect(heat(0, true, FILAMENT.warm / 2)).toBeCloseTo(0.5);
    expect(heat(0.9, true, FILAMENT.warm)).toBe(1);
    expect(heat(1, false, FILAMENT.cool / 4)).toBeCloseTo(0.75);
    expect(heat(0.1, false, FILAMENT.cool)).toBe(0);
  });

  it("swings the blade toward its target at a hand's pace and stops on it", () => {
    expect(swing(0, 1, 0.1)).toBeCloseTo(BLADE_SPEED * 0.1);
    expect(swing(1, 0, 0.1)).toBeCloseTo(1 - BLADE_SPEED * 0.1);
    expect(swing(0.98, 1, 0.1)).toBe(1);
  });
});
