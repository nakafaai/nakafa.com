import { describe, expect, it } from "@effect/vitest";
import {
  ANODE_VOLTAGE,
  beamHeight,
  beamPath,
  PLATE_LIMIT,
  spotHeight,
  TUBE,
} from "@repo/design-system/components/contents/chemistry/cathode/beam";

describe("cathode ray beam", () => {
  it("runs straight with no voltage on the plates", () => {
    expect(spotHeight(0)).toBe(0);
    expect(beamHeight(-1, 100)).toBe(0);
  });

  it("bends toward the positive plate along a parabola, then runs straight", () => {
    expect(beamHeight(TUBE.plates, 100)).toBeCloseTo(
      (100 * TUBE.plates ** 2) / (4 * TUBE.gap * ANODE_VOLTAGE),
      12
    );
    expect(spotHeight(100)).toBeCloseTo(0.3125 + 0.125 * 7, 12);
    expect(spotHeight(-100)).toBeCloseTo(-spotHeight(100), 12);
  });

  it("just grazes a plate at the limiting voltage", () => {
    expect(beamHeight(TUBE.plates, PLATE_LIMIT)).toBeCloseTo(TUBE.gap / 2, 12);
    expect(PLATE_LIMIT).toBe(160);
  });

  it("samples the path from the anode to the screen", () => {
    const path = beamPath(100, 12);

    expect(path).toHaveLength(13);
    expect(path[0]).toEqual([0, 0]);
    expect(path[12]?.[0]).toBe(12);
  });
});
