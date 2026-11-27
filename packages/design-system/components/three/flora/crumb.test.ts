import { describe, expect, it } from "@effect/vitest";
import type { Soil } from "@repo/design-system/components/three/flora/crumb";
import {
  growCrumbs,
  moundMesh,
  soilHeight,
} from "@repo/design-system/components/three/flora/crumb";
import { LEAF_STRIDE } from "@repo/design-system/components/three/flora/habit";
import { Array as Arr, Option, Order } from "effect";

/** A small bed of soil heaped in a pot. */
const BED: Soil = { count: 200, heap: 0.05, radius: 0.3, seed: 7 };

describe("soilHeight", () => {
  it("heaps the bed at its middle and brings it down to nothing at the rim", () => {
    expect(soilHeight(BED, 0, 0)).toBeGreaterThan(BED.heap * 0.7);
    expect(soilHeight(BED, BED.radius, 0)).toBeCloseTo(0);
    expect(soilHeight(BED, 0, BED.radius * 2)).toBeCloseTo(0);
  });

  it("lumps the surface, so two places as far from the middle stand at different heights", () => {
    expect(soilHeight(BED, 0.1, 0)).not.toBeCloseTo(soilHeight(BED, 0, 0.1), 5);
  });
});

describe("growCrumbs", () => {
  const crumbs = Arr.chunksOf(growCrumbs(BED), LEAF_STRIDE);

  it("scatters every crumb on the surface of the bed, inside its rim", () => {
    expect(crumbs).toHaveLength(BED.count);
    for (const crumb of crumbs) {
      const [x, y, z] = [Number(crumb[0]), Number(crumb[1]), Number(crumb[2])];

      expect(Math.hypot(x, z)).toBeLessThan(BED.radius);
      expect(y).toBeGreaterThanOrEqual(soilHeight(BED, x, z));
    }
  });

  it("tilts each crumb its own way on a frame that stays square", () => {
    for (const crumb of crumbs) {
      const heading = [Number(crumb[3]), Number(crumb[4]), Number(crumb[5])];
      const face = [Number(crumb[6]), Number(crumb[7]), Number(crumb[8])];

      expect(Math.hypot(...heading)).toBeCloseTo(1);
      expect(Math.hypot(...face)).toBeCloseTo(1);
      expect(
        Number(heading[0]) * Number(face[0]) +
          Number(heading[1]) * Number(face[1]) +
          Number(heading[2]) * Number(face[2])
      ).toBeCloseTo(0);
    }
  });

  it("makes most crumbs small and a few large", () => {
    const sizes = Arr.sort(
      Arr.map(crumbs, (crumb) => Number(crumb[9])),
      Order.Number
    );

    expect(Number(Option.getOrUndefined(Arr.last(sizes)))).toBeGreaterThan(
      2 * Number(sizes[BED.count / 2])
    );
  });
});

describe("moundMesh", () => {
  it("lays the bed as a disc of triangles that face up", () => {
    const mesh = moundMesh(BED);
    const count = mesh.positions.length / 3;

    expect(count).toBe(21 * 49);
    expect(Math.max(...mesh.indices)).toBe(count - 1);
    for (const normal of Arr.chunksOf(mesh.normals, 3)) {
      expect(Math.hypot(...normal)).toBeCloseTo(1);
      expect(Number(normal[1])).toBeGreaterThan(0.3);
    }
  });
});
