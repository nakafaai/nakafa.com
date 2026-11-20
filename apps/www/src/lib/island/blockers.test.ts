// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, MutableHashMap } from "effect";
import type { FOOTPRINTS } from "@/lib/island/blockers";
import { cacheOf, standingAbout, standingOf } from "@/lib/island/blockers";
import { BRIDGE } from "@/lib/island/collide";
import { keyOf, POINTS } from "@/lib/island/land/chunk";
import { floraOf } from "@/lib/island/land/flora";
import type { Land } from "@/lib/island/land/ground";
import { seatOf } from "@/lib/island/land/site";
import { PLAIN, plainOf } from "@/lib/island/test.plain";

/** A plain with every wild plant cleared from the chunks about the origin, so only what is set down stands on it. */
function bare() {
  const land = plainOf(1);
  for (const cx of [-1, 0, 1]) {
    for (const cz of [-1, 0, 1]) {
      MutableHashMap.set(
        land.clears,
        keyOf(cx, cz),
        new Uint8Array(POINTS).fill(1)
      );
    }
  }
  return land;
}

/** Sets things down in the chunk at the origin, each at a place of its half-block grid. */
function setDown(
  land: Land,
  things: readonly (readonly [
    keyof typeof FOOTPRINTS,
    number,
    number,
    number,
  ])[]
) {
  MutableHashMap.set(
    land.things,
    keyOf(0, 0),
    Arr.map(things, ([kind, x, z, turn]) => ({
      at: z * 2 * 64 + x * 2,
      kind,
      turn,
    }))
  );
}

describe("island/blockers", () => {
  it("keeps a walker off a tree's trunk and a building's walls, turned with the building, never off its crown or eaves", () => {
    const land = bare();
    setDown(land, [
      ["mango", 4, 4, 0],
      ["cottage", 12, 20, 0],
      ["cottage", 22, 20, 1],
      ["bench", 6, 10.5, 3],
      ["well", 20, 6, 2],
    ]);
    expect(standingOf(land, 0, 0)).toEqual({
      blockers: [
        { _tag: "round", radius: 0.55, x: 4, z: 4 },
        { _tag: "box", deep: 2.8, wide: 3.1, x: 12, z: 20 },
        { _tag: "box", deep: 3.1, wide: 2.8, x: 22, z: 20 },
        { _tag: "box", deep: 0.89, wide: 0.36, x: 6, z: 10.5 },
        { _tag: "round", radius: 1, x: 20, z: 6 },
      ],
      decks: [],
    });
  });

  it("lets a walker through flowers, reeds, what lies under water, and the ball, which is a loose thing", () => {
    const land = bare();
    setDown(land, [
      ["sunflower", 4, 4, 0],
      ["reed", 5, 4, 0],
      ["lily", 6, 4, 0],
      ["bush", 7, 4, 0],
      ["coral", 8, 4, 0],
      ["seagrass", 9, 4, 0],
      ["brain", 10, 4, 0],
      ["ball", 11, 4, 0],
    ]);
    expect(standingOf(land, 0, 0)).toEqual({ blockers: [], decks: [] });
    // A flowerbed is walked around: its wooden edge stands in the way.
    setDown(land, [["flowerbed", 4, 4, 0]]);
    expect(standingOf(land, 0, 0).blockers).toEqual([
      { _tag: "box", deep: 0.56, wide: 1.11, x: 4, z: 4 },
    ]);
  });

  it("makes a bridge a deck to walk over between two rails, along the way it was turned", () => {
    const land = bare();
    setDown(land, [
      ["bridge", 10, 10, 0],
      ["bridge", 20, 20, 1],
    ]);
    const { blockers, decks } = standingOf(land, 0, 0);
    expect(decks).toEqual([
      { lengthwise: "x", x: 10, y: seatOf(land, "bridge", 10, 10, 0), z: 10 },
      { lengthwise: "z", x: 20, y: seatOf(land, "bridge", 20, 20, 1), z: 20 },
    ]);
    expect(decks[0].y).toBeGreaterThanOrEqual(PLAIN);
    expect(blockers).toEqual([
      {
        _tag: "box",
        deep: BRIDGE.rail,
        wide: BRIDGE.half,
        x: 10,
        z: 10 - BRIDGE.side,
      },
      {
        _tag: "box",
        deep: BRIDGE.rail,
        wide: BRIDGE.half,
        x: 10,
        z: 10 + BRIDGE.side,
      },
      {
        _tag: "box",
        deep: BRIDGE.half,
        wide: BRIDGE.rail,
        x: 20 - BRIDGE.side,
        z: 20,
      },
      {
        _tag: "box",
        deep: BRIDGE.half,
        wide: BRIDGE.rail,
        x: 20 + BRIDGE.side,
        z: 20,
      },
    ]);
    // The rails leave the deck between them free for a fox 0.7 blocks wide.
    expect(BRIDGE.side - BRIDGE.rail - 0.35).toBeGreaterThan(0.5);
  });

  it("keeps a walker off every wild trunk and rock, each as wide as it grew, and off no bush", () => {
    const land = plainOf(2);
    const flora = Arr.flatMap([-1, 0, 1], (cx) =>
      Arr.flatMap([-1, 0, 1], (cz) => floraOf(land, cx, cz))
    );
    const solid = Arr.filter(
      flora,
      (plant) => plant.kind === "tree" || plant.kind === "rocks"
    );
    expect(solid.length).toBeGreaterThan(3);
    expect(Arr.some(flora, (plant) => plant.kind === "bush")).toBe(true);
    const { blockers } = standingAbout(cacheOf(), land, 0, [16, 16], 30);
    expect(blockers.length).toBe(solid.length);
    for (const plant of solid) {
      expect(blockers).toContainEqual({
        _tag: "round",
        radius: (plant.kind === "tree" ? 0.55 : 0.65) * plant.size,
        x: plant.x,
        z: plant.z,
      });
    }
  });

  it("finds what stands in a neighbouring chunk when it reaches into the place asked about", () => {
    const land = bare();
    setDown(land, [["cottage", 1, 16, 0]]);
    const cache = cacheOf();
    expect(standingAbout(cache, land, 0, [-3, 16], 1).blockers.length).toBe(1);
    expect(standingAbout(cache, land, 0, [-12, 16], 1).blockers.length).toBe(0);
  });

  it("reads the land again only when it changed: the same answer for the same revision, a new one for the next", () => {
    const land = bare();
    const cache = cacheOf();
    const first = standingAbout(cache, land, 4, [10, 10], 2);
    expect(first.blockers).toEqual([]);
    setDown(land, [["lantern", 10, 11, 0]]);
    // Nothing told the cache the land changed, so the frame reads what it already has.
    expect(standingAbout(cache, land, 4, [10.4, 10.2], 2)).toBe(first);
    const next = standingAbout(cache, land, 5, [10, 10], 2);
    expect(next.blockers).toEqual([
      { _tag: "round", radius: 0.2, x: 10, z: 11 },
    ]);
    expect(standingAbout(cache, land, 5, [10, 10], 2)).toBe(next);
  });

  it("starts over when it holds more than a walk's worth of land, and still answers", () => {
    const land = plainOf(6);
    MutableHashMap.set(
      land.clears,
      keyOf(0, 0),
      new Uint8Array(POINTS).fill(1)
    );
    setDown(land, [["lantern", 10, 11, 0]]);
    const cache = cacheOf();
    for (const cx of Arr.range(-5, 5)) {
      for (const cz of Arr.range(-5, 5)) {
        standingAbout(cache, land, 0, [cx * 32 + 16, cz * 32 + 16], 2);
      }
    }
    expect(MutableHashMap.size(cache.chunks)).toBeLessThanOrEqual(96);
    expect(MutableHashMap.size(cache.areas)).toBeLessThanOrEqual(24);
    expect(standingAbout(cache, land, 0, [16, 16], 2).blockers).toEqual([
      { _tag: "round", radius: 0.2, x: 10, z: 11 },
    ]);
  });
});
