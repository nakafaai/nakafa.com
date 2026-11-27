import { describe, expect, it } from "@effect/vitest";
import { moundBody } from "@repo/design-system/components/three/organism/mound";

describe("moundBody", () => {
  it("raises a dome over its outline with one welded normal at the middle", () => {
    const dome = moundBody({
      height: (out) => 1 - out * out,
      paint: (out, _turn, color) => {
        color.setRGB(out, 0, 1 - out);
      },
      rim: () => 2,
      rings: 4,
      spokes: 8,
    });

    expect(dome.position).toHaveLength(5 * 9 * 3);
    expect(dome.index).toHaveLength(4 * 8 * 6);
    expect(dome.position[1]).toBe(1);
    expect(dome.normal[0]).toBeCloseTo(0, 1);
    expect(dome.normal[1]).toBeCloseTo(1, 1);
    expect(dome.normal[2]).toBeCloseTo(0, 1);
    expect(Array.from(dome.normal.subarray(0, 3))).toEqual(
      Array.from(dome.normal.subarray(24, 27))
    );
    const rim = 4 * 9;
    expect(dome.position[rim * 3]).toBeCloseTo(2);
    expect(dome.position[rim * 3 + 1]).toBeCloseTo(0);
    expect(dome.normal[rim * 3]).toBeGreaterThan(0.5);
    expect(dome.color[rim * 3]).toBe(1);
    expect(dome.color[2]).toBe(1);
  });

  it("closes its seam: the first and last spoke share a place and a normal", () => {
    const star = moundBody({
      height: (out, turn) => 0.3 * (1 - out) + 0.05 * Math.sin(turn * 10 * Math.PI),
      paint: (_out, _turn, color) => {
        color.setRGB(1, 1, 1);
      },
      rim: (turn) => 1 + 0.5 * Math.cos(turn * 10 * Math.PI),
      rings: 3,
      spokes: 20,
    });
    const first = 2 * 21;
    const last = first + 20;

    expect(star.position[last * 3]).toBeCloseTo(Number(star.position[first * 3]));
    expect(star.normal[last * 3 + 1]).toBeCloseTo(
      Number(star.normal[first * 3 + 1])
    );
    expect(star.uv[first * 2]).toBeCloseTo(0.5 + Number(star.position[first * 3]));
  });
});
