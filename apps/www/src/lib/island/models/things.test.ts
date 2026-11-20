// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Thing } from "@repo/backend/confect/island/things";
import { Array as Arr, HashMap, HashSet, Option, Order } from "effect";
import type { Face, Vec } from "@/lib/island/models/parts";
import {
  boundsOf,
  flatten,
  MODEL_STRIDE,
  meters,
  normalOf,
} from "@/lib/island/models/parts";
import { THING_LOOKS, thingFaces, thingSize } from "@/lib/island/models/things";
import { SCALE } from "@/lib/island/scale";

/** Every look of every kind, built. */
const MODELS = Arr.flatMap(Thing.literals, (kind) =>
  Arr.makeBy(THING_LOOKS[kind], (look) => ({
    faces: thingFaces(kind, look),
    kind,
    look,
  }))
);

/**
 * How wide, how high and how deep each kind really is, in meters: a mango
 * tree 7 to 8 m, a coconut palm 9 m, a cottage 6 m by 5 m and 5.5 m to its
 * ridge, a bridge 8 m by 2 m, a lighthouse 14 m, a play ball 0.4 m. A
 * windmill is measured with its 4 m sails, and a kite with the 6 m of line
 * under it. What grows in the water is small: a coral head, a tuft of
 * seagrass and a lily pad each fit in under a meter.
 */
const SIZES = {
  ball: { deep: 0.4, high: 0.4, wide: 0.4 },
  balloon: { deep: 7.7, high: 12, wide: 7.7 },
  banana: { deep: 1.9, high: 3, wide: 2.1 },
  bench: { deep: 0.64, high: 0.93, wide: 1.6 },
  boat: { deep: 5, high: 3.3, wide: 2.85 },
  brain: { deep: 0.6, high: 0.29, wide: 0.6 },
  bridge: { deep: 2, high: 2.2, wide: 8 },
  bush: { deep: 1.2, high: 1.2, wide: 1.7 },
  campfire: { deep: 1.2, high: 0.75, wide: 1.2 },
  casuarina: { deep: 2, high: 9, wide: 2.4 },
  coral: { deep: 0.72, high: 0.48, wide: 0.66 },
  cottage: { deep: 5, high: 5.5, wide: 6 },
  fence: { deep: 0.1, high: 1.05, wide: 2 },
  flame: { deep: 8.1, high: 8, wide: 8.3 },
  flowerbed: { deep: 1, high: 0.85, wide: 2 },
  kite: { deep: 1.9, high: 6.4, wide: 0.72 },
  lantern: { deep: 0.38, high: 2.7, wide: 0.38 },
  library: { deep: 5, high: 4.1, wide: 6 },
  lily: { deep: 0.46, high: 0.02, wide: 0.64 },
  lighthouse: { deep: 4.9, high: 14, wide: 4.6 },
  mango: { deep: 5.7, high: 7.5, wide: 5.9 },
  palm: { deep: 6.1, high: 9, wide: 6.1 },
  pine: { deep: 4.4, high: 10, wide: 4.5 },
  reed: { deep: 0.75, high: 1.6, wide: 0.7 },
  rocks: { deep: 1.2, high: 1.1, wide: 1.7 },
  saung: { deep: 4, high: 3.9, wide: 4 },
  seagrass: { deep: 0.47, high: 0.58, wide: 0.38 },
  sunflower: { deep: 0.3, high: 1.8, wide: 0.6 },
  well: { deep: 1.6, high: 2.85, wide: 2.4 },
  windmill: { deep: 4.4, high: 11, wide: 8 },
} satisfies Record<Thing, unknown>;

/** What grows under and on the water, drawn from the reef's own models: sheets of leaf and branching coral, rooted in the bed. */
const WATER: readonly Thing[] = ["brain", "coral", "lily", "seagrass"];

/** Whether a kind stands on dry ground or floats as a built thing, a model of closed solids. */
const isSolid = (kind: Thing) => !Arr.contains(WATER, kind);

/** A length in blocks, in meters. */
const inMeters = (blocks: number) => blocks * SCALE.block;

/** How far a measure is from the real one, as a share of the real one. */
const off = (measured: number, real: number) =>
  Math.abs(inMeters(measured) - real) / real;

/** A point as text, to find the corners that faces share. */
const pointKey = (point: Vec) =>
  Arr.join(
    Arr.map(point, (value) => value.toFixed(4)),
    ","
  );

/** Whether every edge is walked as often one way as the other, so every part is a closed solid and nothing is a sheet seen from one side only. */
function isClosed(faces: readonly Face[]) {
  const edges = Arr.flatMap(faces, (face) =>
    Arr.map(face.corners, (corner, index) => {
      const next = face.corners[(index + 1) % face.corners.length];
      return {
        backward: `${pointKey(next)}>${pointKey(corner)}`,
        forward: `${pointKey(corner)}>${pointKey(next)}`,
      };
    })
  );
  const counts = Arr.reduce(
    edges,
    HashMap.empty<string, number>(),
    (map, { forward }) =>
      HashMap.set(
        map,
        forward,
        Option.getOrElse(HashMap.get(map, forward), () => 0) + 1
      )
  );
  const countOf = (key: string) =>
    Option.getOrElse(HashMap.get(counts, key), () => 0);
  return Arr.every(
    edges,
    ({ backward, forward }) => countOf(forward) === countOf(backward)
  );
}

/** Faces with the corners they stand on. */
const solidOf = (faces: readonly Face[], keys: HashSet.HashSet<string>) => ({
  faces,
  keys,
});

/** The solids a model is made of: its faces grouped by the corners they share. */
function solidsOf(faces: readonly Face[]) {
  return Arr.reduce(
    faces,
    Arr.empty<ReturnType<typeof solidOf>>(),
    (solids, face) => {
      const keys = Arr.map(face.corners, pointKey);
      const touches = (solid: ReturnType<typeof solidOf>) =>
        Arr.some(keys, (key) => HashSet.has(solid.keys, key));
      const apart = Arr.filter(solids, (solid) => !touches(solid));
      const touching = Arr.filter(solids, touches);
      return Arr.append(
        apart,
        solidOf(
          [face, ...Arr.flatMap(touching, (solid) => solid.faces)],
          Arr.reduce(touching, HashSet.fromIterable(keys), (all, solid) =>
            HashSet.union(all, solid.keys)
          )
        )
      );
    }
  );
}

/** The room inside a closed solid: positive when its faces point outward, negative when they point in. */
function volumeOf(faces: readonly Face[]) {
  return Arr.reduce(faces, 0, (total, face) =>
    Arr.reduce(
      Arr.makeBy(face.corners.length - 2, (index) => index),
      total,
      (sum, index) => {
        const [a, b, c] = [
          face.corners[0],
          face.corners[index + 1],
          face.corners[index + 2],
        ];
        return (
          sum +
          (a[0] * (b[1] * c[2] - b[2] * c[1]) +
            a[1] * (b[2] * c[0] - b[0] * c[2]) +
            a[2] * (b[0] * c[1] - b[1] * c[0])) /
            6
        );
      }
    )
  );
}

/** The motion numbers of every corner of a model as the body program reads them: swing, phase, rate and mode. */
const motionsOf = (faces: readonly Face[]) =>
  Arr.map(
    Arr.chunksOf(Arr.fromIterable(flatten(faces)), MODEL_STRIDE),
    (corner) => Arr.drop(corner, 9)
  );

/** The modes a model's corners move by, in order. */
const modesOf = (kind: Thing) =>
  Arr.sort(
    Arr.dedupe(
      Arr.flatMap(
        Arr.filter(MODELS, (model) => model.kind === kind),
        (model: (typeof MODELS)[number]) =>
          Arr.map(motionsOf(model.faces), (motion) => motion[3])
      )
    ),
    Order.Number
  );

describe("island/models/things", () => {
  it("builds every look of every kind from sound flat faces in colors a screen can show", () => {
    Arr.forEach(MODELS, ({ faces, kind }) => {
      expect(faces.length).toBeGreaterThanOrEqual(12);
      // A staghorn coral's many branches take more faces than anything built.
      expect(faces.length).toBeLessThanOrEqual(isSolid(kind) ? 260 : 400);
      expect(flatten(faces).length % (MODEL_STRIDE * 3)).toBe(0);
      expect(
        Arr.every(
          faces,
          (face) =>
            face.corners.length >= 3 &&
            Math.hypot(...normalOf(face.corners)) > 0.5 &&
            Arr.every(
              face.color,
              (tone) => Number.isFinite(tone) && tone >= 0 && tone <= 1
            )
        )
      ).toBe(true);
    });
  });

  it("closes every part as a solid whose faces point outward, so a leaf, a sail or a kite is drawn from both sides", () => {
    const solid = Arr.filter(MODELS, ({ kind }) => isSolid(kind));
    Arr.forEach(solid, ({ faces }) => {
      expect(isClosed(faces)).toBe(true);
      expect(
        Arr.every(solidsOf(faces), (solid) => volumeOf(solid.faces) > 0)
      ).toBe(true);
    });
  });

  it("stands every kind on the ground at its real size, a lighthouse over everything and a ball the smallest", () => {
    Arr.forEach(Thing.literals, (kind) => {
      const size = thingSize(kind);
      const bounds = boundsOf(thingFaces(kind, 0));
      expect(size).toEqual({
        depth: bounds.z[1] - bounds.z[0],
        height: bounds.y[1] - bounds.y[0],
        width: bounds.x[1] - bounds.x[0],
      });
      expect(off(size.width, SIZES[kind].wide)).toBeLessThan(0.15);
      expect(off(size.depth, SIZES[kind].deep)).toBeLessThan(0.15);
    });
    Arr.forEach(MODELS, ({ faces, kind }) => {
      const { x, y, z } = boundsOf(faces);
      if (isSolid(kind)) {
        expect(Math.abs(y[0])).toBeLessThan(0.05);
        expect(off(y[1], SIZES[kind].high)).toBeLessThan(0.15);
        return;
      }
      // A coral is rooted a little under the bed, a lily pad lies flat on the water, and each fits in under a meter.
      expect(inMeters(y[0])).toBeGreaterThan(-0.3);
      expect(Math.abs(inMeters(y[1]) - SIZES[kind].high)).toBeLessThan(0.2);
      expect(inMeters(x[1] - x[0])).toBeLessThan(1);
      expect(inMeters(z[1] - z[0])).toBeLessThan(1);
    });
    const others = (kind: Thing) =>
      Arr.map(
        Arr.filter(Thing.literals, (other) => other !== kind),
        thingSize
      );
    expect(
      Arr.every(
        others("lighthouse"),
        (size) => size.height < thingSize("lighthouse").height
      )
    ).toBe(true);
    const ball = thingSize("ball");
    expect(
      Arr.every(
        others("ball"),
        (size) =>
          Math.max(size.width, size.height, size.depth) >
          Math.max(ball.width, ball.height, ball.depth)
      )
    ).toBe(true);
  });

  it("gives everything that grows by itself three looks of its own and starts over past the last", () => {
    const wild: readonly Thing[] = [
      "mango",
      "flame",
      "casuarina",
      "palm",
      "banana",
      "pine",
      "bush",
      "rocks",
      "reed",
      "sunflower",
      "flowerbed",
      ...WATER,
    ];
    Arr.forEach(Thing.literals, (kind) => {
      expect(THING_LOOKS[kind]).toBe(Arr.contains(wild, kind) ? 3 : 1);
      const looks = Arr.map(
        Arr.filter(MODELS, (model) => model.kind === kind),
        (model) =>
          Arr.join(Arr.map(Arr.fromIterable(flatten(model.faces)), String), ",")
      );
      expect(Arr.dedupe(looks)).toHaveLength(THING_LOOKS[kind]);
    });
    expect(thingFaces("mango", 3)).toEqual(thingFaces("mango", 0));
    expect(thingFaces("palm", -1)).toEqual(thingFaces("palm", 1));
    expect(thingFaces("cottage", 7)).toEqual(thingFaces("cottage", 0));
  });

  it("turns a windmill's sails about its hub, flickers a fire, flies a kite and a balloon on their lines, and leaves every plant to the wind", () => {
    const moving: readonly Thing[] = [
      "windmill",
      "campfire",
      "kite",
      "balloon",
      "lily",
      "seagrass",
    ];
    Arr.forEach(Thing.literals, (kind) => {
      if (!Arr.contains(moving, kind)) {
        expect(modesOf(kind)).toEqual([0]);
      }
    });
    expect(modesOf("windmill")).toEqual([0, 7]);
    expect(modesOf("campfire")).toEqual([0, 6]);
    expect(modesOf("kite")).toEqual([0, 6]);
    expect(modesOf("balloon")).toEqual([6]);
    // A lily pad bobs on the water's face and seagrass bends with the current.
    expect(modesOf("lily")).toEqual([2]);
    expect(modesOf("seagrass")).toEqual([6]);
    // A windmill's tower stands 9 m to the tip of its cap, and its sails reach 4 m from a hub 7 m up, turning once in about seven seconds.
    const windmill = thingFaces("windmill", 0);
    const sails = Arr.filter(windmill, (face) => face.rig !== undefined);
    const tower = Arr.filter(windmill, (face) => face.rig === undefined);
    expect(inMeters(boundsOf(tower).y[1])).toBeCloseTo(9, 6);
    const reach = Arr.map(
      Arr.flatMap(sails, (face) => face.corners),
      ([x, y]) => inMeters(Math.hypot(x, y - meters(7)))
    );
    expect(Math.max(...reach)).toBeGreaterThan(3.9);
    expect(Math.max(...reach)).toBeLessThan(4.2);
    const [pivot, phase, rate, mode] = Option.getOrThrow(
      Arr.findFirst(motionsOf(sails), (motion) => motion[3] === 7)
    );
    expect([pivot, phase, mode]).toEqual([Math.fround(meters(7)), 0, 7]);
    expect(rate).toBeCloseTo(0.9, 6);
    // A kite's line is rooted at its reel, so the reel stays put and the kite swings most.
    const swings = Arr.map(
      motionsOf(thingFaces("kite", 0)),
      ([swing]) => swing
    );
    expect(Math.min(...swings)).toBe(0);
    expect(Math.max(...swings)).toBeGreaterThan(0.2);
  });
});
