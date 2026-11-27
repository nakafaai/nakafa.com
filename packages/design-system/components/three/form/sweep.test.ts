import { describe, expect, it } from "@effect/vitest";
import { grainOf } from "@repo/design-system/components/three/form/detail";
import type { Point } from "@repo/design-system/components/three/form/path";
import { dot } from "@repo/design-system/components/three/form/path";
import { sweepShape } from "@repo/design-system/components/three/form/sweep";
import {
  facesOf,
  isSound,
  normalsOf,
  verticesOf,
} from "@repo/design-system/components/three/form/test.shape";
import { Array as Arr } from "effect";

const GRAIN = grainOf("full", 1);
const ROD: Point[] = [
  [0, 0, 0],
  [0, 1, 0],
];

/** How far a point stands from the y axis. */
function fromAxis([x, , z]: Point) {
  return Math.hypot(x, z);
}

describe("sweepShape of a straight rod", () => {
  const rod = sweepShape({ path: ROD, radius: 0.05 }, GRAIN);

  it("stands every side vertex at its radius, facing straight out", () => {
    const vertices = verticesOf(rod);
    const normals = normalsOf(rod);
    const side = Arr.filter(
      Arr.zip(vertices, normals),
      ([, normal]) => Math.abs(normal[1]) < 0.5
    );
    expect(side.length).toBeGreaterThan(16);
    for (const [vertex, normal] of side) {
      expect(fromAxis(vertex)).toBeCloseTo(0.05, 6);
      expect(dot(normal, [vertex[0] / 0.05, 0, vertex[2] / 0.05])).toBeCloseTo(
        1,
        5
      );
    }
    expect(isSound(rod)).toBe(true);
  });

  it("closes both ends with flat caps that face along the rod, and winds every face outward", () => {
    const normals = normalsOf(rod);
    expect(Arr.some(normals, (normal) => normal[1] === 1)).toBe(true);
    expect(Arr.some(normals, (normal) => normal[1] === -1)).toBe(true);
    const faces = facesOf(rod);
    expect(faces.inward).toBe(0);
    expect(faces.empty).toBe(0);
    expect(faces.outward).toBe(rod.indices.length / 3);
  });

  it("lays its texture in scene units: along the rod, then around it", () => {
    const along = Arr.makeBy(rod.uvs.length / 2, (index) => rod.uvs[index * 2]);
    const around = Arr.makeBy(
      rod.uvs.length / 2,
      (index) => rod.uvs[index * 2 + 1]
    );
    expect(Math.min(...along)).toBeCloseTo(-0.05, 6);
    expect(Math.max(...along)).toBeCloseTo(1.05, 6);
    expect(Math.max(...around)).toBeCloseTo(2 * Math.PI * 0.05, 6);
  });

  it("takes fewer triangles on a phone than on a desktop", () => {
    const phone = sweepShape({ path: ROD, radius: 0.05 }, grainOf("low", 1));
    expect(phone.indices.length).toBeLessThan(rod.indices.length);
  });
});

describe("sweepShape ends", () => {
  it("leaves an open end hollow", () => {
    const tube = sweepShape({ ends: "open", path: ROD, radius: 0.05 }, GRAIN);
    for (const vertex of verticesOf(tube)) {
      expect(fromAxis(vertex)).toBeCloseTo(0.05, 6);
    }
    expect(facesOf(tube).inward).toBe(0);
  });

  it("domes a round end out by its radius, and names each end apart", () => {
    const pin = sweepShape(
      { ends: ["round", "open"], path: ROD, radius: 0.05 },
      GRAIN
    );
    const heights = Arr.map(verticesOf(pin), (vertex) => vertex[1]);
    expect(Math.min(...heights)).toBeCloseTo(-0.05, 6);
    expect(Math.max(...heights)).toBeCloseTo(1, 6);
    expect(facesOf(pin).inward).toBe(0);
    expect(facesOf(pin).empty).toBe(0);
    expect(isSound(pin)).toBe(true);
    for (const vertex of Arr.filter(verticesOf(pin), (at) => at[1] < 0)) {
      expect(Math.hypot(...vertex)).toBeCloseTo(0.05, 6);
    }
  });
});

describe("sweepShape with a varying radius", () => {
  it("eases a taper from stop to stop and leans its normals with the slope", () => {
    const horn = sweepShape(
      {
        ends: "open",
        path: ROD,
        radius: [
          [0, 0.02],
          [0.5, 0.06],
          [1, 0.06],
        ],
      },
      GRAIN
    );
    const vertices = verticesOf(horn);
    const normals = normalsOf(horn);
    const at = (height: number) =>
      Arr.findFirstIndex(
        vertices,
        (vertex) => Math.abs(vertex[1] - height) < 1e-6
      );
    const widths = Arr.map(vertices, fromAxis);
    expect(Math.min(...widths)).toBeCloseTo(0.02, 6);
    expect(Math.max(...widths)).toBeCloseTo(0.06, 6);
    const middle = Arr.findFirst(
      Arr.zip(vertices, normals),
      ([vertex]) => Math.abs(vertex[1] - 0.25) < 1e-6
    );
    expect(at(0.25)._tag).toBe("Some");
    expect(middle._tag).toBe("Some");
    if (middle._tag === "Some") {
      expect(fromAxis(middle.value[0])).toBeCloseTo(0.04, 6);
      expect(middle.value[1][1]).toBeLessThan(-0.1);
    }
    expect(isSound(horn)).toBe(true);
    expect(facesOf(horn).inward).toBe(0);
  });
});

describe("sweepShape of a flat strip", () => {
  it("thins the section toward the direction its face looks", () => {
    const strip = sweepShape(
      {
        ends: "open",
        flat: [0.1, [0, 0, 1]],
        path: [
          [0, 0, 0],
          [1, 0, 0],
        ],
        radius: 0.05,
      },
      GRAIN
    );
    const vertices = verticesOf(strip);
    expect(Math.max(...Arr.map(vertices, (vertex) => vertex[2]))).toBeCloseTo(
      0.005,
      6
    );
    expect(Math.max(...Arr.map(vertices, (vertex) => vertex[1]))).toBeCloseTo(
      0.05,
      6
    );
    const broad = Arr.filter(
      normalsOf(strip),
      (normal) => Math.abs(normal[2]) > 0.9
    );
    expect(broad.length).toBeGreaterThan(vertices.length / 2);
    expect(isSound(strip)).toBe(true);
    expect(facesOf(strip).inward).toBe(0);
  });
});

describe("sweepShape along a curve", () => {
  it("carries the section round a coil without a twist or a flip", () => {
    const coil = sweepShape(
      {
        path: {
          from: [0, 0, 0],
          kind: "helix",
          radius: 0.05,
          to: [0, 0.2, 0],
          turns: 5,
        },
        radius: 0.004,
      },
      GRAIN
    );
    expect(isSound(coil)).toBe(true);
    const faces = facesOf(coil);
    expect(faces.inward).toBe(0);
    expect(faces.empty).toBe(0);
    for (const vertex of verticesOf(coil)) {
      expect(Math.abs(fromAxis(vertex) - 0.05)).toBeLessThan(0.0041);
    }
  });

  it("puts sections where a pipe run bends and none along its straight legs", () => {
    const run = sweepShape(
      {
        ends: "open",
        path: {
          bend: 0.05,
          kind: "route",
          points: [
            [0, 0, 0],
            [1, 0, 0],
            [1, 1, 0],
          ],
        },
        radius: 0.01,
      },
      GRAIN
    );
    const stations = Arr.dedupe(
      Arr.map(verticesOf(run), (vertex) => Math.round(vertex[0] * 1e4))
    );
    const straight = Arr.filter(
      verticesOf(run),
      (vertex) => vertex[0] > 0.02 && vertex[0] < 0.9
    );
    expect(straight).toHaveLength(0);
    expect(stations.length).toBeGreaterThan(8);
    expect(facesOf(run).inward).toBe(0);
    expect(isSound(run)).toBe(true);
  });
});
