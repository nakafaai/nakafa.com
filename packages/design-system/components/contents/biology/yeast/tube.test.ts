// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BOILING_TUBE,
  capacity,
  innerRadius,
  levelOf,
  TEST_TUBE,
  volumeAt,
  wettedArea,
} from "@repo/design-system/components/contents/biology/yeast/tube";

describe("round-bottomed tubes", () => {
  it("holds the capacities the catalogue lists for its walls", () => {
    expect(capacity(BOILING_TUBE)).toBeCloseTo(58.2, 1);
    expect(capacity(TEST_TUBE)).toBeCloseTo(24, 0);
    expect(innerRadius(BOILING_TUBE)).toBeCloseTo(0.0113, 12);
  });

  it("stands a volume above the hemisphere on a cylinder", () => {
    const hemisphere = (2 / 3) * Math.PI * 0.0113 ** 3 * 1e6;
    const level = levelOf(BOILING_TUBE, 20);

    expect(level).toBeCloseTo(
      0.0113 + (20 - hemisphere) / 1e6 / (Math.PI * 0.0113 ** 2),
      12
    );
    expect(volumeAt(BOILING_TUBE, level)).toBeCloseTo(20, 10);
  });

  it("solves a small volume inside the round foot exactly", () => {
    const level = levelOf(BOILING_TUBE, 1);

    expect(level).toBeLessThan(innerRadius(BOILING_TUBE));
    expect(volumeAt(BOILING_TUBE, level)).toBeCloseTo(1, 10);
    expect(levelOf(BOILING_TUBE, 0)).toBeCloseTo(0, 12);
  });

  it("wets the cap of the foot and the wall above it", () => {
    const radius = innerRadius(BOILING_TUBE);
    const small = levelOf(BOILING_TUBE, 1);
    const full = levelOf(BOILING_TUBE, 20);

    expect(wettedArea(BOILING_TUBE, 1)).toBeCloseTo(
      2 * Math.PI * radius * small,
      12
    );
    expect(wettedArea(BOILING_TUBE, 20)).toBeCloseTo(
      2 * Math.PI * radius * full,
      12
    );
  });
});
