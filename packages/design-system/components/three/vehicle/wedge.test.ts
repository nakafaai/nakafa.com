import { describe, expect, it } from "@effect/vitest";
import { WAKE_ANGLE } from "@repo/design-system/components/three/vehicle/motion";
import { wedgeSheet } from "@repo/design-system/components/three/vehicle/wedge";

describe("wedgeSheet", () => {
  const sheet = wedgeSheet(3);
  const count = sheet.positions.length / 3;

  it("opens astern at Kelvin's angle", () => {
    const x = sheet.positions[(count - 1) * 3];
    const z = sheet.positions[(count - 1) * 3 + 2];
    expect(x).toBeCloseTo(-1, 9);
    expect(z).toBeCloseTo(0.035 + Math.tan(WAKE_ANGLE), 9);
    expect(sheet.positions[2]).toBeCloseTo(-0.035, 9);
  });

  it("carries no foam at the very stern or at the far end", () => {
    expect(sheet.colors[3]).toBe(0);
    expect(sheet.colors[(count - 1) * 4 + 3]).toBe(0);
    expect(sheet.colors[(count / 2) * 4 + 3]).toBeGreaterThan(0);
  });

  it("lays the tiles along the wedge and one across, as whole triangles", () => {
    expect(sheet.uvs[(count - 1) * 2]).toBeCloseTo(3, 9);
    expect(sheet.uvs[(count - 1) * 2 + 1]).toBe(1);
    expect(sheet.indices.length % 3).toBe(0);
    expect(Math.max(...sheet.indices)).toBe(count - 1);
  });
});
