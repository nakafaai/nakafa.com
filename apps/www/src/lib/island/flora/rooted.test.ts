// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, MutableHashMap, MutableRef, Option } from "effect";
import {
  blockersAbout,
  rootAt,
  rootedBodies,
  rootsOf,
  wildModel,
} from "@/lib/island/flora/rooted";
import { keyOf, POINTS } from "@/lib/island/land/chunk";
import { modelKey } from "@/lib/island/models/kinds";
import { thingSize } from "@/lib/island/models/things";
import {
  bareOf,
  floodAll,
  GROUND,
  plainOf,
  setThings,
} from "@/lib/island/test.world";

/** The bodies of one model among those drawn, six numbers each, none when the model is not drawn. */
const bodiesOf = (drawn: ReturnType<typeof rootedBodies>, key: string) =>
  Arr.flatMap(drawn, ([model, places]) =>
    modelKey(model) === key ? Arr.chunksOf(Arr.fromIterable(places), 6) : []
  );

/** Reads frames about an anchor until every chunk in sight has been read. */
function settled(
  roots: ReturnType<typeof rootsOf>,
  land: Parameters<typeof rootedBodies>[1],
  anchor: readonly [number, number],
  revision: number
) {
  return Arr.reduce(
    Arr.range(0, 20),
    rootedBodies(roots, land, anchor, revision),
    () => rootedBodies(roots, land, anchor, revision)
  );
}

describe("island/flora/rooted", () => {
  it("draws each wild plant as the model of its habit, its look and a coral's form from its place", () => {
    expect(wildModel("tree", 4)).toEqual({
      _tag: "thing",
      kind: "mango",
      look: 1,
    });
    expect(wildModel("pine", 5)).toEqual({
      _tag: "thing",
      kind: "pine",
      look: 2,
    });
    expect(wildModel("rocks", 3)).toEqual({
      _tag: "thing",
      kind: "rocks",
      look: 0,
    });
    expect(wildModel("lily", 7)).toEqual({
      _tag: "reef",
      kind: "lily",
      look: 1,
    });
    expect(wildModel("brain", 8)).toEqual({
      _tag: "reef",
      kind: "brain",
      look: 2,
    });
    expect(wildModel("seagrass", 0)._tag).toBe("reef");
    const corals = Arr.map(Arr.range(0, 14), (dice) =>
      wildModel("coral", dice)
    );
    expect(
      Arr.dedupe(Arr.map(corals, (model) => modelKey(model)))
    ).toHaveLength(15);
    expect(wildModel("coral", 6)).toEqual({
      _tag: "reef",
      kind: "table",
      look: 1,
    });
  });

  it("reads a chunk once: every wild plant and every thing where it stands, as bodies by model, a plant giving to the wind", () => {
    const land = plainOf(1);
    const roots = rootsOf();
    const wild = rootAt(roots, land, 0, 0);
    expect(wild.standing.length).toBeGreaterThan(1);
    expect(
      Arr.every(
        wild.standing,
        (stood) => stood.origin._tag === "wild" && stood.y === GROUND
      )
    ).toBe(true);
    expect(rootAt(roots, land, 0, 0)).toBe(wild);
    expect(MutableRef.get(roots.version)).toBe(1);
    // What grows under water is a reef plant, small to a finger and still in the wind.
    const sea = plainOf(1);
    floodAll(sea, [-32, -32], [64, 64], 2, "sea");
    const wet = rootAt(rootsOf(), sea, 0, 0).standing;
    expect(wet.length).toBeGreaterThan(0);
    expect(
      Arr.every(
        wet,
        (stood) =>
          stood.model._tag === "reef" &&
          stood.height === 0.7 &&
          stood.y === GROUND - 2
      )
    ).toBe(true);
    const bare = bareOf(1);
    setThings(
      bare,
      [0, 0],
      [
        ["cottage", 16, 16, 1],
        ["mango", 6, 6, 0],
        ["mango", 9, 26, 0],
        ["coral", 3, 3, 0],
      ]
    );
    const built = rootAt(rootsOf(), bare, 0, 0);
    expect(Arr.map(built.standing, (stood) => stood.origin)).toEqual([
      { _tag: "thing", at: 32 * 64 + 32, cx: 0, cz: 0, kind: "cottage" },
      { _tag: "thing", at: 12 * 64 + 12, cx: 0, cz: 0, kind: "mango" },
      { _tag: "thing", at: 52 * 64 + 18, cx: 0, cz: 0, kind: "mango" },
      { _tag: "thing", at: 6 * 64 + 6, cx: 0, cz: 0, kind: "coral" },
    ]);
    const cottage = built.standing[0];
    expect([cottage.x, cottage.y, cottage.z]).toEqual([16, GROUND, 16]);
    expect(cottage.yaw).toBeCloseTo(Math.PI / 2, 6);
    expect(cottage.height).toBeCloseTo(thingSize("cottage").height, 6);
    expect(cottage.radius).toBeCloseTo(thingSize("cottage").width / 2, 6);
    const places = Arr.flatMap(built.bodies, ([model, run]) =>
      Arr.map(Arr.chunksOf(Arr.fromIterable(run), 6), (place) => ({
        kind: model._tag === "thing" ? model.kind : "none",
        place,
      }))
    );
    expect(places).toHaveLength(4);
    const sways = (kind: string) =>
      Arr.map(
        Arr.filter(places, (body) => body.kind === kind),
        (body) => body.place[4]
      );
    expect(sways("cottage")).toEqual([0]);
    expect(sways("coral")).toEqual([0]);
    expect(sways("mango")).toHaveLength(2);
    expect(sways("mango")[0]).toBeCloseTo(-1 / thingSize("mango").height, 5);
  });

  it("answers what a walker cannot pass about a place from the chunks that reach into it", () => {
    const land = bareOf(1);
    setThings(land, [0, 0], [["well", 30, 16, 0]]);
    setThings(land, [1, 0], [["rocks", 2, 16, 0]]);
    const roots = rootsOf();
    const inside = blockersAbout(roots, land, [16, 16], 5);
    expect(inside).toHaveLength(1);
    expect(blockersAbout(roots, land, [16, 16], 5)).toBe(inside);
    expect(blockersAbout(roots, land, [30, 16], 5)).toHaveLength(2);
    expect(blockersAbout(roots, land, [-20, -20], 5)).toEqual([]);
  });

  it("reads a few chunks a frame, the nearest first, then hands the painter the very same lists frame after frame", () => {
    const land = plainOf(4);
    const roots = rootsOf();
    const first = rootedBodies(roots, land, [16, 16], 0);
    expect(MutableHashMap.size(roots.chunks)).toBe(3);
    expect(MutableHashMap.has(roots.chunks, keyOf(0, 0))).toBe(true);
    expect(first.length).toBeGreaterThan(0);
    const all = settled(roots, land, [16, 16], 0);
    expect(MutableHashMap.size(roots.chunks)).toBe(49);
    const again = rootedBodies(roots, land, [17, 15], 0);
    expect(again).toBe(all);
    expect(Arr.dedupe(Arr.map(all, ([model]) => modelKey(model)))).toHaveLength(
      all.length
    );
    // A revision that changed nothing here keeps every chunk and every list.
    expect(rootedBodies(roots, land, [16, 16], 1)).toBe(all);
    const count = Arr.reduce(
      all,
      0,
      (sum, [, places]) => sum + places.length / 6
    );
    expect(count).toBe(
      Arr.reduce(
        Arr.fromIterable(MutableHashMap.values(roots.chunks)),
        0,
        (sum, root) => sum + root.standing.length
      )
    );
  });

  it("reads a chunk again only when the learner changed it or the ground beside it", () => {
    const land = bareOf(4);
    const roots = rootsOf();
    setThings(land, [0, 0], [["well", 16, 16, 0]]);
    const before = settled(roots, land, [16, 16], 0);
    expect(bodiesOf(before, "thing-well-0")).toHaveLength(1);
    const kept = Option.getOrThrow(
      MutableHashMap.get(roots.chunks, keyOf(2, 2))
    );
    const held = Option.getOrThrow(
      MutableHashMap.get(roots.chunks, keyOf(0, 0))
    );
    setThings(
      land,
      [0, 0],
      [
        ["well", 16, 16, 0],
        ["well", 6, 6, 0],
      ]
    );
    // Until the revision rises nobody looks.
    expect(rootedBodies(roots, land, [16, 16], 0)).toBe(before);
    const after = settled(roots, land, [16, 16], 1);
    expect(bodiesOf(after, "thing-well-0")).toHaveLength(2);
    expect(
      Option.getOrThrow(MutableHashMap.get(roots.chunks, keyOf(2, 2)))
    ).toBe(kept);
    expect(
      Option.getOrThrow(MutableHashMap.get(roots.chunks, keyOf(0, 0)))
    ).not.toBe(held);
    // Ground the learner moved is read again with the chunks beside it, whose plants at the edge stand on it too.
    const beside = Option.getOrThrow(
      MutableHashMap.get(roots.chunks, keyOf(1, 1))
    );
    const far = Option.getOrThrow(
      MutableHashMap.get(roots.chunks, keyOf(3, 3))
    );
    MutableHashMap.set(land.lifts, keyOf(0, 0), new Int8Array(POINTS).fill(8));
    MutableHashMap.set(
      land.paints,
      keyOf(0, 0),
      new Uint8Array(POINTS).fill(2)
    );
    settled(roots, land, [16, 16], 2);
    expect(
      Option.getOrThrow(MutableHashMap.get(roots.chunks, keyOf(1, 1)))
    ).not.toBe(beside);
    expect(
      Option.getOrThrow(MutableHashMap.get(roots.chunks, keyOf(3, 3)))
    ).toBe(far);
  });

  it("forgets the chunks the camera left far behind", () => {
    const land = plainOf(4);
    const roots = rootsOf();
    settled(roots, land, [16, 16], 0);
    rootAt(roots, land, 4, 4);
    rootedBodies(roots, land, [16 + 32 * 3, 16], 0);
    expect(MutableHashMap.has(roots.chunks, keyOf(-3, 0))).toBe(true);
    expect(MutableHashMap.has(roots.chunks, keyOf(4, 4))).toBe(true);
    rootedBodies(roots, land, [16 + 32 * 4, 16], 0);
    expect(MutableHashMap.has(roots.chunks, keyOf(-3, 0))).toBe(false);
    expect(MutableHashMap.has(roots.chunks, keyOf(-2, 0))).toBe(true);
  });
});
