// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, HashSet, Option, Result } from "effect";
import { PAINT } from "@/lib/island/land/chunk";
import { setCleared, setPaint } from "@/lib/island/land/edits";
import { floraOf, wildOf } from "@/lib/island/land/flora";
import { depthAt, landOf, surfaceAt } from "@/lib/island/land/ground";
import { homeOf } from "@/lib/island/land/home";
import { pointOf } from "@/lib/island/land/relief";

const SEED = 4242;

/** A dry, level, open place on the first terrace, which each case changes one thing of. */
const MEADOW = {
  depth: -1,
  elevation: 5,
  first: true,
  forest: 0,
  p: 0.5,
  q: 0.5,
  reef: false,
  sand: 0,
  slope: 0.1,
  wet: -5,
};

describe("island/land/flora", () => {
  it("grows reeds and lilies in fresh shallows only", () => {
    const pond = { ...MEADOW, depth: 0.4, p: 0.1 };
    expect(wildOf({ ...pond, wet: 0.1 })).toEqual(Option.some("reed"));
    expect(wildOf({ ...pond, wet: 0.8 })).toEqual(Option.some("lily"));
    expect(wildOf({ ...pond, p: 0.6 })).toEqual(Option.none());
    expect(wildOf({ ...pond, first: false })).toEqual(Option.none());
    expect(wildOf({ ...pond, depth: 1.5 })).toEqual(Option.none());
  });

  it("grows a reef in patches on the shallow sea bed, with sea grass between", () => {
    const bed = { ...MEADOW, depth: 2, elevation: -3, p: 0.3, reef: true };
    expect(wildOf({ ...bed, q: 0.2 })).toEqual(Option.some("coral"));
    expect(wildOf({ ...bed, q: 0.6 })).toEqual(Option.some("brain"));
    expect(wildOf({ ...bed, q: 0.9 })).toEqual(Option.some("seagrass"));
    expect(wildOf({ ...bed, p: 0.05, reef: false })).toEqual(
      Option.some("seagrass")
    );
    expect(wildOf({ ...bed, reef: false })).toEqual(Option.none());
    expect(wildOf({ ...bed, p: 0.8 })).toEqual(Option.none());
    expect(wildOf({ ...bed, depth: 0.3 })).toEqual(Option.none());
    expect(wildOf({ ...bed, depth: 9 })).toEqual(Option.none());
  });

  it("leaves the wet sand at the sea's edge bare, and scatters rocks on steep ground", () => {
    expect(wildOf({ ...MEADOW, elevation: 0.2, p: 0.01 })).toEqual(
      Option.none()
    );
    expect(wildOf({ ...MEADOW, p: 0.1, slope: 0.9 })).toEqual(
      Option.some("rocks")
    );
    expect(wildOf({ ...MEADOW, slope: 0.9 })).toEqual(Option.none());
  });

  it("lines a bank with reeds and a beach with palms and the odd rock", () => {
    expect(wildOf({ ...MEADOW, p: 0.2, wet: -0.2 })).toEqual(
      Option.some("reed")
    );
    expect(wildOf({ ...MEADOW, wet: -0.2 })).toEqual(Option.none());
    const beach = { ...MEADOW, sand: 0.9 };
    expect(wildOf({ ...beach, p: 0.05 })).toEqual(Option.some("palm"));
    expect(wildOf({ ...beach, elevation: 0.6, p: 0.05 })).toEqual(
      Option.none()
    );
    expect(wildOf({ ...beach, p: 0.99 })).toEqual(Option.some("rocks"));
    expect(wildOf(beach)).toEqual(Option.none());
  });

  it("grows the woods: pines up high, broad crowns below with a flame tree or a banana plant among them", () => {
    const wood = { ...MEADOW, forest: 1, p: 0.2 };
    expect(wildOf({ ...wood, elevation: 20 })).toEqual(Option.some("pine"));
    expect(wildOf({ ...wood, q: 0.3 })).toEqual(Option.some("tree"));
    expect(wildOf({ ...wood, q: 0.8 })).toEqual(Option.some("flame"));
    expect(wildOf({ ...wood, q: 0.95 })).toEqual(Option.some("banana"));
    expect(wildOf(MEADOW)).toEqual(Option.none());
  });

  it("fills the second try of a cell with bushes, rocks and a lone tree on open ground", () => {
    const second = { ...MEADOW, first: false };
    expect(wildOf({ ...second, p: 0.02 })).toEqual(Option.some("bush"));
    expect(wildOf({ ...second, p: 0.98 })).toEqual(Option.some("rocks"));
    expect(wildOf({ ...second, p: 0.96 })).toEqual(Option.some("tree"));
    expect(wildOf({ ...second, forest: 0.6, p: 0.96 })).toEqual(Option.none());
    expect(wildOf(second)).toEqual(Option.none());
  });

  it("roots the same plants in a chunk every time, each inside it and on its ground or its water", () => {
    const land = landOf(SEED);
    const [x, z] = homeOf(SEED);
    const chunks = Arr.flatMap(Arr.range(-2, 2), (dz) =>
      Arr.map(
        Arr.range(-2, 2),
        (dx) => [Math.floor(x / 32) + dx, Math.floor(z / 32) + dz] as const
      )
    );
    const plants = Arr.flatMap(chunks, ([cx, cz]) => floraOf(land, cx, cz));
    expect(plants.length).toBeGreaterThan(40);
    expect(floraOf(landOf(SEED), chunks[0][0], chunks[0][1])).toEqual(
      floraOf(land, chunks[0][0], chunks[0][1])
    );
    for (const plant of plants) {
      expect(plant.size).toBeGreaterThanOrEqual(0.78);
      expect(plant.size).toBeLessThan(1.28);
      expect(Math.abs(plant.i - plant.x)).toBeLessThanOrEqual(0.5);
      expect(plant.y).toBeGreaterThan(0);
    }
    expect(
      HashSet.size(HashSet.fromIterable(Arr.map(plants, (plant) => plant.kind)))
    ).toBeGreaterThan(3);
  });

  it("floats a lily on the water's face of a lake's shallows", () => {
    const land = landOf(SEED);
    // The chunks that hold a fresh shallow, found from the seed's own points.
    const shallows = Arr.dedupe(
      Arr.filterMap(
        Arr.flatMap(Arr.range(-70, 70), (j) =>
          Arr.map(Arr.range(-70, 70), (i) => [i * 5, j * 5] as const)
        ),
        ([x, z]) => {
          const point = pointOf(SEED, x, z);
          return point.elevation > 0.3 && point.wet > 0.25 && point.wet < 0.45
            ? Result.succeed(`${Math.floor(x / 32)},${Math.floor(z / 32)}`)
            : Result.failVoid;
        }
      )
    );
    // The first of those chunks that grows a lily: most do not, so the search stops as soon as one does.
    const lilies = Option.getOrThrow(
      Arr.findFirst(shallows, (name) => {
        const [cx, cz] = Arr.map(name.split(","), Number);
        return Option.liftPredicate(
          Arr.filter(floraOf(land, cx, cz), (plant) => plant.kind === "lily"),
          Arr.isReadonlyArrayNonEmpty
        );
      })
    );
    for (const lily of lilies) {
      expect(depthAt(land, lily.i, lily.j)).toBeGreaterThan(0);
      expect(lily.y).toBeCloseTo(surfaceAt(land, lily.i, lily.j), 5);
    }
  });

  it("grows nothing on a path or where the learner cleared", () => {
    const land = landOf(SEED);
    const [x, z] = homeOf(SEED);
    const [cx, cz] = [Math.floor(x / 32), Math.floor(z / 32)];
    const wide = Arr.flatMap(Arr.range(-2, 2), (dz) =>
      Arr.flatMap(Arr.range(-2, 2), (dx) =>
        Arr.map(floraOf(land, cx + dx, cz + dz), (plant) => ({
          ...plant,
          cx: cx + dx,
          cz: cz + dz,
        }))
      )
    );
    const [first, second] = wide;
    setCleared(land, first.i, first.j, true);
    setPaint(land, second.i, second.j, PAINT.path);
    const after = (plant: (typeof wide)[number]) =>
      Arr.some(
        floraOf(land, plant.cx, plant.cz),
        (other) => other.i === plant.i && other.j === plant.j
      );
    expect(after(first)).toBe(false);
    expect(after(second)).toBe(false);
    expect(after(wide[2])).toBe(true);
  });
});
