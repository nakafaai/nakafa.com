// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  FILAMENT_SECONDS,
  filamentSettled,
  heatFilament,
} from "@repo/design-system/components/contents/mathematics/binary/filament";

describe("a lamp's filament", () => {
  it("covers 95% of the way to full glow in its warm-up time", () => {
    expect(heatFilament(0, true, FILAMENT_SECONDS.warm)).toBeCloseTo(
      1 - Math.exp(-3),
      6
    );
  });

  it("fades more slowly than it warms", () => {
    const warmed = heatFilament(0, true, 0.04);
    const cooled = 1 - heatFilament(1, false, 0.04);
    expect(cooled).toBeLessThan(warmed);
  });

  it("settles on its target, so a still lamp asks for no more frames", () => {
    expect(heatFilament(0.999, true, 0.05)).toBe(1);
    expect(heatFilament(0.001, false, 0.05)).toBe(0);
    expect(filamentSettled(1, true)).toBe(true);
    expect(filamentSettled(0.5, false)).toBe(false);
  });
});
