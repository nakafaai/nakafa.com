import { describe, expect, it } from "@effect/vitest";
import {
  girthAt,
  NACELLE,
  nacelleGeometry,
  nacellePoint,
} from "@repo/design-system/components/three/energy/nacelle";

describe("girthAt", () => {
  it("closes at both ends and is fullest behind the neck", () => {
    expect(girthAt(0)).toBeCloseTo(0, 6);
    expect(girthAt(1)).toBeCloseTo(0, 6);
    expect(girthAt(0.3)).toBeCloseTo(1, 6);
    expect(girthAt(0.1)).toBeLessThan(girthAt(0.3));
    expect(girthAt(0.8)).toBeLessThan(girthAt(0.3));
  });
});

describe("nacellePoint", () => {
  it("runs from the front face at z = 0 back along -z", () => {
    expect(nacellePoint(0, 0)[2]).toBeCloseTo(0, 6);
    expect(nacellePoint(1, 0)[2]).toBeCloseTo(-NACELLE.length, 6);
  });

  it("draws rounded-square sections that reach the full width and height", () => {
    expect(nacellePoint(0.3, 0)[0]).toBeCloseTo(NACELLE.half, 6);
    expect(nacellePoint(0.3, 0.75)[1]).toBeCloseTo(NACELLE.tall, 6);
    const [x, y] = nacellePoint(0.3, 0.125);
    expect(Math.abs(x)).toBeGreaterThan(NACELLE.half * 0.8);
    expect(Math.abs(y)).toBeGreaterThan(NACELLE.tall * 0.8);
  });
});

describe("nacelleGeometry", () => {
  it("lofts a shell whose faces look outward", () => {
    const geometry = nacelleGeometry();
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const side = 20 * 49;
    expect(position.getX(side)).toBeGreaterThan(0);
    expect(normal.getX(side)).toBeGreaterThan(0.8);
  });
});
