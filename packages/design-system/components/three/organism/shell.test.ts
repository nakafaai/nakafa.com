import { describe, expect, it } from "@effect/vitest";
import type { Shell } from "@repo/design-system/components/three/organism/shell";
import { shellBody } from "@repo/design-system/components/three/organism/shell";

/** A plain plate on a ball of radius 2, facing +x, with its side painted into its red channel. */
const PLATE: Shell = {
  across: [-0.5, 0.5],
  along: [-0.5, 0.5],
  columns: 8,
  edge: () => [0, 0],
  lump: 0,
  paint: (_along, _across, side, color) => {
    color.setRGB(0.5 + 0.5 * side, 0, 0);
  },
  radius: 2,
  rows: 8,
  seed: 3,
  thick: 0.2,
};

/** The place of one vertex of a plate with eight columns: seventeen round each ring. */
function placeOf(form: ReturnType<typeof shellBody>, ring: number, at: number) {
  const vertex = (ring * 17 + at) * 3;
  return Array.from(form.position.subarray(vertex, vertex + 3));
}

describe("shellBody", () => {
  it("raises an outer and an inner face a thickness apart at the middle", () => {
    const plate = shellBody(PLATE);

    expect(plate.position).toHaveLength(9 * 17 * 3);
    expect(plate.index).toHaveLength(8 * 16 * 6);
    const [outerX, outerY, outerZ] = placeOf(plate, 4, 4);
    const [innerX] = placeOf(plate, 4, 12);
    expect(outerX).toBeCloseTo(2.1);
    expect(outerY).toBeCloseTo(0);
    expect(outerZ).toBeCloseTo(0);
    expect(innerX).toBeCloseTo(1.9);
    expect(plate.color[(4 * 17 + 4) * 3]).toBeCloseTo(1);
    expect(plate.color[(4 * 17 + 12) * 3]).toBeCloseTo(0);
  });

  it("faces outwards on its outer face and inwards on its inner one", () => {
    const plate = shellBody(PLATE);

    expect(plate.normal[(4 * 17 + 4) * 3]).toBeGreaterThan(0.9);
    expect(plate.normal[(4 * 17 + 12) * 3]).toBeLessThan(-0.9);
  });

  it("closes its rim: both faces meet at every edge and the seam shares a normal", () => {
    const plate = shellBody(PLATE);

    expect(placeOf(plate, 4, 0)).toEqual(placeOf(plate, 4, 16));
    expect(
      Array.from(plate.normal.subarray(4 * 17 * 3, 4 * 17 * 3 + 3))
    ).toEqual(
      Array.from(
        plate.normal.subarray((4 * 17 + 16) * 3, (4 * 17 + 16) * 3 + 3)
      )
    );
    const [firstX, , firstZ] = placeOf(plate, 0, 4);
    const [backX, , backZ] = placeOf(plate, 0, 12);
    expect(firstX).toBeCloseTo(Number(backX));
    expect(firstZ).toBeCloseTo(Number(backZ));
    expect(plate.color[4 * 17 * 3]).toBeCloseTo(0.5);
  });

  it("shifts each side edge by its own serration and swells with noise", () => {
    const plain = shellBody(PLATE);
    const serrated = shellBody({
      ...PLATE,
      edge: (along) => [0.1 * along, -0.2],
      lump: 0.5,
    });

    const firstEdge = placeOf(serrated, 8, 0);
    expect(Math.atan2(Number(firstEdge[2]), Number(firstEdge[0]))).toBeCloseTo(
      -0.4
    );
    const lastEdge = placeOf(serrated, 4, 8);
    expect(Math.atan2(Number(lastEdge[2]), Number(lastEdge[0]))).toBeCloseTo(
      0.3
    );
    expect(placeOf(serrated, 4, 4)).not.toEqual(placeOf(plain, 4, 4));
  });
});
