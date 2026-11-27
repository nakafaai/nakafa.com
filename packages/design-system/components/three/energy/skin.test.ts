import { describe, expect, it } from "@effect/vitest";
import { skin } from "@repo/design-system/components/three/energy/skin";

/** A tube of radius 1 along +y whose rings run counterclockwise seen from its far end. */
function tube(along: number, round: number) {
  const turn = -round * 2 * Math.PI;
  return [Math.cos(turn), along * 3, Math.sin(turn)] as const;
}

describe("skin", () => {
  it("stretches two faces over every span of every ring and repeats the seam", () => {
    const geometry = skin(4, 8, tube);
    expect(geometry.getAttribute("position").count).toBe(5 * 9);
    expect(geometry.getIndex()?.count).toBe(4 * 8 * 6);
    expect(geometry.getAttribute("position").getY(5 * 9 - 1)).toBeCloseTo(3, 6);
  });

  it("runs the texture once round the rings and once along the part", () => {
    const uv = skin(4, 8, tube).getAttribute("uv");
    expect([uv.getX(0), uv.getY(0)]).toEqual([0, 0]);
    expect([uv.getX(5 * 9 - 1), uv.getY(5 * 9 - 1)]).toEqual([1, 1]);
  });

  it("faces outward when the rings run counterclockwise seen from the far end", () => {
    const geometry = skin(4, 8, tube);
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const vertex = 2 * 9 + 3;
    expect(
      normal.getX(vertex) * position.getX(vertex) +
        normal.getZ(vertex) * position.getZ(vertex)
    ).toBeGreaterThan(0.9);
  });
});
