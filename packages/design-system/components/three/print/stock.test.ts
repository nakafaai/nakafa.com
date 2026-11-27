// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  finishOf,
  PLAIN_SUBSTRATE,
} from "@repo/design-system/components/three/print/stock";

const BRASS = { metalness: 1, roughness: 0.32 };
const MAPLE = { metalness: 0, roughness: 0.55 };

describe("how a print answers the light", () => {
  it("lets flat ink take the sheen of what it lies on, a little duller", () => {
    expect(finishOf("ink", MAPLE)).toMatchObject({
      metalness: 0,
      relief: 0,
      roughness: 0.67,
    });
    expect(finishOf("ink", { metalness: 0, roughness: 0.95 }).roughness).toBe(
      1
    );
  });

  it("stands fired enamel proud of the glass, glazed and smooth whatever lies under it", () => {
    const enamel = finishOf("enamel", PLAIN_SUBSTRATE);
    expect(enamel.relief).toBeGreaterThan(0);
    expect(enamel.coat).toBeGreaterThan(0);
    expect(enamel.roughness).toBe(finishOf("enamel", BRASS).roughness);
  });

  it("cuts an engraving into its part, duller than the metal and still partly metal", () => {
    const cut = finishOf("engraving", BRASS);
    expect(cut.relief).toBeLessThan(0);
    expect(cut.roughness).toBeCloseTo(0.62);
    expect(cut.metalness).toBeCloseTo(0.3);
    expect(finishOf("engraving", MAPLE).metalness).toBe(0);
  });

  it("makes paper matt and flat", () => {
    expect(finishOf("paper", BRASS)).toMatchObject({
      glow: 0,
      metalness: 0,
      relief: 0,
      roughness: 0.86,
    });
  });

  it("lights a display from behind, under its glass", () => {
    const display = finishOf("display", PLAIN_SUBSTRATE);
    expect(display.glow).toBeGreaterThan(0);
    expect(display.coat).toBe(1);
  });
});
