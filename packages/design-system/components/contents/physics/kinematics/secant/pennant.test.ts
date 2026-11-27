import { describe, expect, it } from "@effect/vitest";
import {
  pennantSheet,
  rippleAt,
} from "@repo/design-system/components/contents/physics/kinematics/secant/pennant";

describe("rippleAt", () => {
  it("holds the cloth still at the pole and lets it wave toward the point", () => {
    expect(rippleAt(0, 1.3, 0.6)).toBe(0);
    expect(Math.abs(rippleAt(1, 0.4, 0.6))).toBeLessThanOrEqual(0.6 * 0.12);
    expect(rippleAt(0.8, 0, 0.6)).not.toBeCloseTo(rippleAt(0.8, 0.3, 0.6), 4);
  });
});

describe("pennantSheet", () => {
  const sheet = pennantSheet(0.6, 0.4);
  const count = sheet.positions.length / 3;

  it("hangs its hoist down the pole from the origin", () => {
    expect(sheet.positions[0]).toBe(0);
    expect(sheet.positions[1]).toBeCloseTo(0, 9);
    expect(sheet.positions[6 * 3 + 1]).toBeCloseTo(-0.4, 9);
    expect(sheet.alongs[0]).toBe(0);
  });

  it("tapers to a point at the end of its fly, level with the middle of the hoist", () => {
    expect(sheet.positions[(count - 1) * 3]).toBeCloseTo(0.6, 9);
    expect(sheet.positions[(count - 1) * 3 + 1]).toBeCloseTo(-0.2, 9);
    expect(sheet.positions[(count - 7) * 3 + 1]).toBeCloseTo(-0.2, 9);
    expect(sheet.alongs[count - 1]).toBe(1);
  });

  it("is whole triangles over its own vertices", () => {
    expect(sheet.alongs.length).toBe(count);
    expect(sheet.indices.length % 3).toBe(0);
    expect(Math.max(...sheet.indices)).toBe(count - 1);
  });
});
