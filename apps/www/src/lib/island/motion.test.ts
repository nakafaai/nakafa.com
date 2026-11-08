import { describe, expect, it } from "@effect/vitest";
import { swimAt } from "@/lib/island/motion";

const area = { from: [0, 0] as const, to: [3, 2] as const };

describe("island motion", () => {
  it("swims a fish across its pond under the surface and back", () => {
    const fish = { animal: "fish", area, depth: 0.5, phase: 0 } as const;
    expect(swimAt(fish, 0)).toMatchObject({
      dx: 1,
      visible: true,
      x: 0,
      y: -0.75,
    });
    expect(swimAt(fish, 4.5).x).toBeCloseTo(3);
    expect(swimAt(fish, 6).dx).toBe(-1);
    expect(swimAt(fish, 9).x).toBeCloseTo(0);
  });

  it("paddles a duck round its pond on the surface", () => {
    const duck = { animal: "duck", area, depth: 0, phase: 0 } as const;
    const start = swimAt(duck, 0);
    expect(start).toMatchObject({ dx: -0, dz: 1, visible: true, y: -0.25 });
    expect(start.x).toBeCloseTo(1.5 + 1.05);
    expect(swimAt(duck, 4.5).z).toBeCloseTo(1 + 0.7);
  });

  it("lets Nina peek out of the middle for a few seconds and sink again", () => {
    const nina = { animal: "nina", area, depth: 0, phase: 0 } as const;
    expect(swimAt(nina, 2)).toMatchObject({ visible: true, x: 1.5, z: 1 });
    expect(swimAt(nina, 2).y).toBeGreaterThan(swimAt(nina, 0.1).y);
    expect(swimAt(nina, 8).visible).toBe(false);
    expect(swimAt(nina, 14 + 2).visible).toBe(true);
  });
});
