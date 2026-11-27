import { describe, expect, it } from "@effect/vitest";
import type { Limb } from "@repo/design-system/components/three/flora/limb";
import {
  joinMeshes,
  limbMesh,
  placeAt,
  smoothPath,
} from "@repo/design-system/components/three/flora/limb";
import { Array as Arr, Option } from "effect";

/** A straight, upright, smooth axis that tapers from its base to its tip. */
const STEM: Limb = {
  arc: 1,
  base: 0.1,
  flare: 0,
  furrow: 0,
  path: [
    [0, 0, 0],
    [0, 0.5, 0],
    [0, 1, 0],
  ],
  seed: 1,
  sides: 8,
  tip: 0.02,
};

/** The numbers of a mesh in threes. */
function triples(values: readonly number[]) {
  return Arr.map(Arr.chunksOf(values, 3), ([x, y, z]) => ({
    x: Number(x),
    y: Number(y),
    z: Number(z),
  }));
}

describe("placeAt", () => {
  it("holds a step before the start or past the end of a path to its ends", () => {
    const path = [
      [0, 0, 0],
      [1, 2, 3],
    ] as const;

    expect(placeAt(path, -4)).toEqual([0, 0, 0]);
    expect(placeAt(path, 1)).toEqual([1, 2, 3]);
    expect(placeAt(path, 9)).toEqual([1, 2, 3]);
  });

  it("takes a path with no places to lie at the origin", () => {
    expect(placeAt([], 0)).toEqual([0, 0, 0]);
  });
});

describe("smoothPath", () => {
  it("passes through its first and last places with one place per step", () => {
    const path = smoothPath(
      [
        [0, 0, 0],
        [1, 2, 0],
        [0, 4, 1],
      ],
      10
    );

    expect(path).toHaveLength(11);
    expect(path[0]).toEqual([0, 0, 0]);
    expect(path[10]?.[1]).toBeCloseTo(4);
    expect(path[5]?.[0]).toBeCloseTo(1);
  });
});

describe("limbMesh", () => {
  it("sweeps a ring of vertices at every place of the path", () => {
    const mesh = limbMesh(STEM);

    expect(mesh.positions).toHaveLength(3 * 9 * 3);
    expect(mesh.normals).toHaveLength(mesh.positions.length);
    expect(mesh.uvs).toHaveLength(3 * 9 * 2);
    expect(mesh.indices).toHaveLength(2 * 8 * 6);
  });

  it("tapers from its base to its tip with normals that point straight out", () => {
    const mesh = limbMesh(STEM);
    const places = triples(mesh.positions);
    const normals = triples(mesh.normals);

    expect(Math.hypot(Number(places[0]?.x), Number(places[0]?.z))).toBeCloseTo(
      0.1
    );
    expect(
      Math.hypot(
        Number(Option.getOrUndefined(Arr.last(places))?.x),
        Number(Option.getOrUndefined(Arr.last(places))?.z)
      )
    ).toBeCloseTo(0.02);
    for (const normal of normals) {
      expect(normal.y).toBeCloseTo(0);
      expect(Math.hypot(normal.x, normal.z)).toBeCloseTo(1);
    }
  });

  it("swells at its collar and stands in ridges where it is furrowed", () => {
    const flared = triples(limbMesh({ ...STEM, flare: 0.8 }).positions);
    const barked = triples(limbMesh({ ...STEM, furrow: 0.4 }).positions);
    const reach = Arr.map(Arr.take(barked, 8), (place) =>
      Math.hypot(place.x, place.z)
    );

    expect(
      Math.hypot(Number(flared[1]?.x), Number(flared[1]?.z))
    ).toBeGreaterThan(0.14);
    expect(Math.max(...reach) - Math.min(...reach)).toBeGreaterThan(0.005);
  });

  it("sweeps only the back half of an axis cut open along its length", () => {
    const places = triples(limbMesh({ ...STEM, arc: 0.5 }).positions);

    for (const place of places) {
      expect(place.z).toBeLessThanOrEqual(1e-9);
    }
  });

  it("sweeps an axis that lies level as soundly as one that stands", () => {
    const mesh = limbMesh({
      ...STEM,
      path: [
        [0, 0, 0],
        [0.5, 0, 0],
        [1, 0.1, 0],
      ],
    });

    expect(Arr.every(mesh.positions, Number.isFinite)).toBe(true);
    expect(triples(mesh.normals)[0]?.x).toBeCloseTo(0);
  });
});

describe("joinMeshes", () => {
  it("joins meshes into one whose triangles still name their own vertices", () => {
    const one = limbMesh(STEM);
    const joined = joinMeshes([one, one]);

    expect(joined.positions).toHaveLength(2 * one.positions.length);
    expect(joined.indices[one.indices.length]).toBe(
      Number(one.indices[0]) + one.positions.length / 3
    );
    expect(Math.max(...joined.indices)).toBe(joined.positions.length / 3 - 1);
  });
});
