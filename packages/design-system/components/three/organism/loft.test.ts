import { describe, expect, it } from "@effect/vitest";
import type { Loft } from "@repo/design-system/components/three/organism/loft";
import {
  dorsal,
  duct,
  finBody,
  loftBody,
  ovoid,
  stationAt,
} from "@repo/design-system/components/three/organism/loft";
import { Array as Arr } from "effect";

/** A plain spindle along x, closed at both tips, one unit wide at its middle. */
const SPINDLE: Loft = {
  along: 8,
  around: 12,
  belly: 0,
  lump: 0,
  paint: (along, around, color) => {
    color.setRGB(along, dorsal(around), 0);
  },
  relief: () => 0,
  seed: 1,
  square: 2,
  stations: [
    { centre: [-1, 0, 0], tall: 0, wide: 0 },
    { centre: [0, 0, 0], tall: 1, wide: 1 },
    { centre: [1, 0, 0], tall: 0, wide: 0 },
  ],
  up: [0, 1, 0],
};

/** The place of the vertex at a ring and a column of the spindle. */
function vertexAt(position: Float32Array, ring: number, column: number) {
  const at = (ring * 13 + column) * 3;
  return Arr.map([0, 1, 2], (axis) => Number(position[at + axis]));
}

describe("dorsal", () => {
  it("is 1 on the back, 0 on the belly and a half on the flanks", () => {
    expect(dorsal(0)).toBeCloseTo(1);
    expect(dorsal(0.5)).toBeCloseTo(0);
    expect(dorsal(0.25)).toBeCloseTo(0.5);
  });
});

describe("stationAt", () => {
  it("passes through its stations and holds the ends beyond them", () => {
    expect(stationAt(SPINDLE.stations, 0.5).tall).toBeCloseTo(1);
    expect(stationAt(SPINDLE.stations, -1).centre[0]).toBeCloseTo(-1);
    expect(stationAt(SPINDLE.stations, 2).centre[0]).toBeCloseTo(1);
    expect(stationAt(SPINDLE.stations, 0.25).centre[0]).toBeCloseTo(-0.5625);
    expect(stationAt(SPINDLE.stations, 0.25).tall).toBeCloseTo(0.5);
  });

  it("never lets a section be narrower than nothing where the curve overshoots", () => {
    const pinched = [
      { centre: [0, 0, 0], tall: 1, wide: 1 },
      { centre: [1, 0, 0], tall: 0, wide: 0 },
      { centre: [2, 0, 0], tall: 0, wide: 0 },
      { centre: [3, 0, 0], tall: 1, wide: 1 },
    ] as const;

    expect(stationAt(pinched, 0.5).tall).toBe(0);
  });
});

describe("loftBody", () => {
  it("lofts a closed skin with the back up and normals that face outwards", () => {
    const body = loftBody(SPINDLE);
    const back = vertexAt(body.position, 4, 0);
    const side = vertexAt(body.position, 4, 3);
    const belly = vertexAt(body.position, 4, 6);

    expect(body.position).toHaveLength(9 * 13 * 3);
    expect(body.index).toHaveLength(8 * 12 * 6);
    expect(back[1]).toBeCloseTo(1);
    expect(belly[1]).toBeCloseTo(-1);
    expect(Math.abs(Number(side[2]))).toBeCloseTo(1);
    expect(vertexAt(body.normal, 4, 0)[1]).toBeCloseTo(1);
    expect(vertexAt(body.normal, 4, 6)[1]).toBeCloseTo(-1);
    expect(vertexAt(body.color, 4, 0)).toEqual([0.5, 1, 0]);
  });

  it("closes each tip to one point with one normal, and welds its seam", () => {
    const body = loftBody(SPINDLE);

    expect(vertexAt(body.position, 0, 0)).toEqual(vertexAt(body.position, 0, 5));
    expect(vertexAt(body.normal, 0, 0)).toEqual(vertexAt(body.normal, 0, 5));
    expect(vertexAt(body.normal, 0, 0)[0]).toBeCloseTo(-1);
    expect(vertexAt(body.normal, 4, 12)).toEqual(vertexAt(body.normal, 4, 0));
    expect(vertexAt(body.position, 4, 12)[1]).toBeCloseTo(1);
  });

  it("flattens the belly, squares the section, and raises relief and lumps", () => {
    const flat = loftBody({ ...SPINDLE, belly: 0.5 });
    const boxy = loftBody({ ...SPINDLE, square: 8 });
    const ridged = loftBody({ ...SPINDLE, relief: () => 0.5 });
    const lumpy = loftBody({ ...SPINDLE, lump: 0.3 });

    expect(vertexAt(flat.position, 4, 6)[1]).toBeCloseTo(-0.5);
    expect(vertexAt(flat.position, 4, 0)[1]).toBeCloseTo(1);
    expect(Number(vertexAt(boxy.position, 4, 1)[1])).toBeGreaterThan(0.95);
    expect(vertexAt(ridged.position, 4, 0)[1]).toBeCloseTo(1.5);
    expect(vertexAt(lumpy.position, 4, 0)[1]).not.toBeCloseTo(1);
  });
});

describe("finBody", () => {
  it("tapers a thin foil from its root to a swept tip", () => {
    const fin = finBody({
      along: 8,
      around: 8,
      chord: 0.4,
      paint: (_along, _around, color) => {
        color.setRGB(1, 1, 1);
      },
      span: 1,
      sweep: 0.3,
      thick: 0.05,
    });
    const tip = (8 * 9) * 3;

    expect(fin.position[1]).toBeCloseTo(0.2);
    expect(fin.position[tip]).toBeCloseTo(1);
    expect(fin.position[tip + 1]).toBeCloseTo(-0.3);
    expect(Math.abs(Number(fin.position[2 * 3 + 2]))).toBeCloseTo(0.025);
  });
});

describe("ovoid", () => {
  it("is fullest at its middle, closed at its ends, and blunter where asked", () => {
    const egg = ovoid([1, 2, 3], 2, 0.5, 0.4, 0);
    const blunt = ovoid([0, 0, 0], 2, 0.5, 0.4, 1);

    expect(egg).toHaveLength(13);
    expect(egg[0]?.centre).toEqual([0, 2, 3]);
    expect(egg[0]?.wide).toBeCloseTo(0);
    expect(egg[6]?.wide).toBeCloseTo(0.5);
    expect(egg[6]?.tall).toBeCloseTo(0.4);
    expect(egg[3]?.wide).toBeCloseTo(0.5 * Math.SQRT1_2);
    expect(Number(blunt[3]?.wide)).toBeGreaterThan(Number(blunt[9]?.wide));
  });
});

describe("duct", () => {
  it("runs a round section through each point at its own radius", () => {
    expect(
      duct([
        [0, 0, 0, 0.1],
        [1, 2, 3, 0.2],
      ])
    ).toEqual([
      { centre: [0, 0, 0], tall: 0.1, wide: 0.1 },
      { centre: [1, 2, 3], tall: 0.2, wide: 0.2 },
    ]);
  });
});
