import { describe, expect, it } from "@effect/vitest";
import { grainOf } from "@repo/design-system/components/three/form/detail";
import type { Point } from "@repo/design-system/components/three/form/path";
import {
  facesOf,
  isSound,
  normalsOf,
  verticesOf,
} from "@repo/design-system/components/three/form/test.shape";
import { turnShape } from "@repo/design-system/components/three/form/turn";
import { Array as Arr } from "effect";

const GRAIN = grainOf("full", 1);

/** How far a point stands from the y axis. */
function fromAxis([x, , z]: Point) {
  return Math.hypot(x, z);
}

describe("turnShape of a solid", () => {
  const puck = turnShape(
    {
      profile: [
        [0, 0],
        [0.05, 0],
        [0.05, 0.02],
        [0, 0.02],
      ],
    },
    GRAIN
  );

  it("closes on the axis, faces out everywhere and leaves no empty triangle", () => {
    expect(isSound(puck)).toBe(true);
    const faces = facesOf(puck);
    expect(faces.inward).toBe(0);
    expect(faces.empty).toBe(0);
    const vertices = verticesOf(puck);
    expect(Math.max(...Arr.map(vertices, fromAxis))).toBeCloseTo(0.05, 6);
    expect(Math.min(...Arr.map(vertices, (vertex) => vertex[1]))).toBe(0);
    expect(Math.max(...Arr.map(vertices, (vertex) => vertex[1]))).toBeCloseTo(
      0.02,
      6
    );
  });

  it("cuts a sharp corner to a fine edge and keeps the faces beside it true", () => {
    const vertices = verticesOf(puck);
    const normals = normalsOf(puck);
    const corner = Arr.filter(
      vertices,
      (vertex) => fromAxis(vertex) > 0.0499 && vertex[1] < 1e-9
    );
    expect(corner).toHaveLength(0);
    const cut = Arr.filter(
      vertices,
      (vertex) => fromAxis(vertex) > 0.0493 && vertex[1] < 0.0007
    );
    expect(cut.length).toBeGreaterThan(0);
    const wall = Arr.filter(
      Arr.zip(vertices, normals),
      ([vertex]) =>
        Math.abs(vertex[1] - 0.01) < 0.009 && fromAxis(vertex) > 0.0499
    );
    for (const [vertex, normal] of wall) {
      expect(normal[1]).toBeCloseTo(0, 6);
      expect(normal[0]).toBeCloseTo(vertex[0] / 0.05, 5);
    }
    expect(Arr.some(normals, (normal) => normal[1] === 1)).toBe(true);
    expect(Arr.some(normals, (normal) => normal[1] === -1)).toBe(true);
  });

  it("lays its texture in scene units: around its widest ring, then along its outline", () => {
    const around = Arr.makeBy(
      puck.uvs.length / 2,
      (index) => puck.uvs[index * 2]
    );
    const along = Arr.makeBy(
      puck.uvs.length / 2,
      (index) => puck.uvs[index * 2 + 1]
    );
    expect(Math.max(...around)).toBeCloseTo(2 * Math.PI * 0.05, 6);
    expect(Math.min(...along)).toBe(0);
    expect(Math.max(...along)).toBeGreaterThan(0.11);
    expect(Math.max(...along)).toBeLessThan(0.12);
  });

  it("takes fewer triangles on a phone than on a desktop", () => {
    const phone = turnShape(
      {
        profile: [
          [0, 0],
          [0.05, 0],
          [0.05, 0.02],
          [0, 0.02],
        ],
      },
      grainOf("low", 1)
    );
    expect(phone.indices.length).toBeLessThan(puck.indices.length);
  });
});

describe("turnShape corners", () => {
  it("rounds gentle corners into a curve that stays inside the drawn outline", () => {
    const drawn = Arr.makeBy(7, (step): readonly [number, number] => {
      const lean = (step / 6) * (Math.PI / 2);
      return [0.04 * Math.cos(lean), 0.04 * Math.sin(lean)];
    });
    const dome = turnShape({ profile: [...drawn, [0, 0.04]] }, GRAIN);
    const rows = Arr.dedupe(
      Arr.map(verticesOf(dome), (vertex) => vertex[1].toFixed(6))
    );
    expect(rows.length).toBeGreaterThan(10);
    for (const vertex of verticesOf(dome)) {
      expect(Math.hypot(...vertex)).toBeLessThan(0.04 + 1e-6);
      expect(Math.hypot(...vertex)).toBeGreaterThan(0.0385);
    }
    expect(isSound(dome)).toBe(true);
    expect(facesOf(dome).inward).toBe(0);
  });

  it("closes an outline that returns to its first point, and drops a point drawn twice", () => {
    const ring = turnShape(
      {
        profile: [
          [0.03, 0],
          [0.05, 0],
          [0.05, 0],
          [0.05, 0.01],
          [0.03, 0.01],
          [0.03, 0],
        ],
      },
      GRAIN
    );
    expect(isSound(ring)).toBe(true);
    const faces = facesOf(ring);
    expect(faces.inward).toBe(0);
    expect(faces.empty).toBe(0);
    expect(Math.min(...Arr.map(verticesOf(ring), fromAxis))).toBeCloseTo(
      0.03,
      6
    );
    expect(Arr.some(normalsOf(ring), (normal) => normal[0] < -0.99)).toBe(true);
  });

  it("keeps a corner that doubles back as a point with a face on each side", () => {
    const disc = turnShape(
      {
        profile: [
          [0, 0],
          [0.05, 0],
          [0, 0.0001],
        ],
      },
      GRAIN
    );
    expect(isSound(disc)).toBe(true);
    expect(Math.max(...Arr.map(verticesOf(disc), fromAxis))).toBeCloseTo(
      0.05,
      6
    );
    expect(facesOf(disc).inward).toBe(0);
  });
});

describe("turnShape of glass", () => {
  const BEAKER = [
    [0, 0],
    [0.04, 0],
    [0.04, 0.1],
  ] as const;
  const beaker = turnShape({ profile: BEAKER, wall: 0.002 }, GRAIN);

  it("gives the vessel an inside one wall in, over a base half as thick again", () => {
    const vertices = verticesOf(beaker);
    const normals = normalsOf(beaker);
    const inside = Arr.filter(
      Arr.zip(vertices, normals),
      ([vertex, normal]) =>
        vertex[1] < 0.09 &&
        normal[1] === 0 &&
        normal[0] * vertex[0] + normal[2] * vertex[2] < 0
    );
    expect(inside.length).toBeGreaterThan(0);
    for (const [vertex] of inside) {
      expect(fromAxis(vertex)).toBeCloseTo(0.038, 6);
    }
    const floor = Arr.filter(
      Arr.zip(vertices, normals),
      ([vertex, normal]) => normal[1] > 0.999 && fromAxis(vertex) < 0.03
    );
    expect(floor.length).toBeGreaterThan(0);
    for (const [vertex] of floor) {
      expect(vertex[1]).toBeCloseTo(0.003, 6);
    }
  });

  it("takes a base of its own thickness when one is named", () => {
    const heavy = turnShape({ profile: BEAKER, wall: [0.002, 0.006] }, GRAIN);
    const floor = Arr.filter(
      Arr.zip(verticesOf(heavy), normalsOf(heavy)),
      ([vertex, normal]) => normal[1] > 0.999 && fromAxis(vertex) < 0.03
    );
    expect(floor.length).toBeGreaterThan(0);
    for (const [vertex] of floor) {
      expect(vertex[1]).toBeCloseTo(0.006, 6);
    }
  });

  it("rounds the lip over the rim, and is sound and closed", () => {
    const top = Math.max(...Arr.map(verticesOf(beaker), (vertex) => vertex[1]));
    expect(top).toBeGreaterThan(0.1005);
    expect(top).toBeLessThan(0.1011);
    expect(isSound(beaker)).toBe(true);
    const faces = facesOf(beaker);
    expect(faces.inward).toBe(0);
    expect(faces.empty).toBe(0);
  });

  it("gives a sleeve with no base a lip at both ends", () => {
    const sleeve = turnShape(
      {
        profile: [
          [0.04, 0],
          [0.04, 0.05],
          [0.04, 0.1],
        ],
        wall: 0.004,
      },
      GRAIN
    );
    const heights = Arr.map(verticesOf(sleeve), (vertex) => vertex[1]);
    expect(Math.max(...heights)).toBeGreaterThan(0.1015);
    expect(Math.min(...heights)).toBeLessThan(-0.0015);
    expect(Math.min(...Arr.map(verticesOf(sleeve), fromAxis))).toBeCloseTo(
      0.036,
      6
    );
    expect(isSound(sleeve)).toBe(true);
    expect(facesOf(sleeve).inward).toBe(0);
  });

  it("keeps a narrow neck open and a sharp shoulder from spiking inward", () => {
    const vial = turnShape(
      {
        profile: [
          [0, 0],
          [0.02, 0],
          [0.02, 0.04],
          [0.001, 0.0401],
          [0.001, 0.06],
        ],
        wall: 0.002,
      },
      GRAIN
    );
    expect(isSound(vial)).toBe(true);
    expect(Math.min(...Arr.map(verticesOf(vial), fromAxis))).toBe(0);
    for (const vertex of verticesOf(vial)) {
      expect(vertex[1]).toBeGreaterThan(-1e-9);
      expect(vertex[1]).toBeLessThan(0.0612);
    }
  });
});

describe("turnShape with a spout", () => {
  const BEAKER = [
    [0, 0],
    [0.04, 0],
    [0.04, 0.1],
  ] as const;
  const plain = turnShape({ profile: BEAKER, wall: 0.002 }, GRAIN);
  const spouted = turnShape(
    { profile: BEAKER, spout: true, wall: 0.002 },
    GRAIN
  );

  it("draws the rim out and up toward +x and leaves the rest of the vessel alone", () => {
    const reach = (shape: typeof plain) =>
      Math.max(...Arr.map(verticesOf(shape), (vertex) => vertex[0]));
    const back = (shape: typeof plain) =>
      Math.min(...Arr.map(verticesOf(shape), (vertex) => vertex[0]));
    const top = (shape: typeof plain) =>
      Math.max(...Arr.map(verticesOf(shape), (vertex) => vertex[1]));
    expect(reach(spouted)).toBeGreaterThan(reach(plain) + 0.004);
    expect(back(spouted)).toBeCloseTo(back(plain), 6);
    expect(top(spouted)).toBeGreaterThan(top(plain) + 0.002);
    const low = (shape: typeof plain) =>
      Arr.filter(verticesOf(shape), (vertex) => vertex[1] < 0.08).length;
    expect(low(spouted)).toBe(low(plain));
  });

  it("keeps its normals true over the drawn-out rim", () => {
    expect(isSound(spouted)).toBe(true);
    expect(facesOf(spouted).inward).toBe(0);
    const lean = Arr.filter(
      Arr.zip(verticesOf(spouted), normalsOf(spouted)),
      ([vertex, normal]) =>
        vertex[0] > 0.041 && Math.abs(vertex[2]) < 0.002 && normal[0] > 0
    );
    expect(lean.length).toBeGreaterThan(0);
    expect(Arr.some(lean, ([, normal]) => normal[1] < -0.2)).toBe(true);
  });
});

describe("turnShape cutaway", () => {
  it("turns only as far round as its arc, from +z toward +x", () => {
    const half = turnShape(
      {
        arc: [0, Math.PI],
        profile: [
          [0.05, 0],
          [0.05, 0.1],
        ],
      },
      GRAIN
    );
    const full = turnShape(
      {
        profile: [
          [0.05, 0],
          [0.05, 0.1],
        ],
      },
      GRAIN
    );
    for (const vertex of verticesOf(half)) {
      expect(vertex[0]).toBeGreaterThan(-1e-7);
    }
    expect(half.indices.length * 2).toBe(full.indices.length);
    const sliver = turnShape(
      {
        arc: [0, 0.01],
        profile: [
          [0.05, 0],
          [0.05, 0.1],
        ],
      },
      GRAIN
    );
    expect(sliver.indices.length / 3).toBe(6);
  });
});

describe("turnShape of a small part in a large lab", () => {
  it("keeps its rim round however coarse the grain", () => {
    const cup = turnShape(
      {
        profile: [
          [0.01, 0],
          [0.01, 0.02],
        ],
      },
      1
    );
    const rim = Arr.filter(verticesOf(cup), (vertex) => vertex[1] > 0.0199);
    expect(rim.length).toBeGreaterThanOrEqual(33);
    expect(facesOf(cup).inward).toBe(0);
  });
});
