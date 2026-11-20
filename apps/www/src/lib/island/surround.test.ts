// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { MutableHashMap } from "effect";
import { keyOf } from "@/lib/island/land/chunk";
import { spotOf } from "@/lib/island/land/site";
import { surroundOf } from "@/lib/island/surround";
import { cover, flood, PLAIN, plainOf, raise } from "@/lib/island/test.plain";

describe("island/surround", () => {
  it("hears nothing about a place of open grass", () => {
    expect(surroundOf(plainOf(2), 3, -4)).toEqual({
      fall: 0,
      fire: 0,
      forest: 0,
      fresh: 0,
      meadow: 0,
      river: 0,
      sea: 0,
    });
  });

  it("hears a wood or a meadow by how much of the ground about it is one", () => {
    const land = plainOf(3);
    for (let i = -70; i <= 70; i += 1) {
      for (let j = -40; j <= 40; j += 1) {
        cover(land, i, j, i < 0 ? "forest" : "meadow");
      }
    }
    const deep = surroundOf(land, -34, 0);
    const edge = surroundOf(land, 0, 0);
    expect(deep.forest).toBeGreaterThan(0.9);
    expect(edge.forest).toBeGreaterThan(0.2);
    expect(edge.forest).toBeLessThan(0.7);
    expect(edge.meadow).toBeGreaterThan(0.3);
    expect(surroundOf(land, 34, 0).meadow).toBeGreaterThan(0.9);
  });

  it("hears the sea, a lake and a river each as near as its nearest water, on either side of the origin", () => {
    const land = plainOf(3);
    for (let j = -60; j <= 60; j += 1) {
      for (let i = -64; i <= -50; i += 1) {
        flood(land, i, j, 4, "sea");
      }
      flood(land, 30, j, 0.5, "river");
      flood(land, 31, j, 0.5, "river");
    }
    for (let i = -13; i <= -7; i += 1) {
      for (let j = 37; j <= 43; j += 1) {
        flood(land, i, j, 0.6);
      }
    }
    const shore = surroundOf(land, -48, 0);
    expect(shore.sea).toBeGreaterThan(0.7);
    expect(shore.fresh).toBe(0);
    expect(surroundOf(land, -30, 0).sea).toBeGreaterThan(0);
    expect(surroundOf(land, -30, 0).sea).toBeLessThan(shore.sea);
    const bank = surroundOf(land, 30, 0);
    expect(bank.river).toBe(1);
    expect(bank.fresh).toBe(1);
    expect(bank.fall).toBe(0);
    expect(bank.sea).toBe(0);
    const pond = surroundOf(land, -10, 40);
    expect(pond.fresh).toBe(1);
    expect(pond.river).toBe(0);
  });

  it("hears a waterfall where a river's face drops", () => {
    const land = plainOf(2);
    for (let i = -10; i <= 10; i += 1) {
      flood(land, i, 0, 0.5, "river");
      if (i > 0) {
        // Past the lip the river runs four blocks lower.
        raise(land, i, 0, PLAIN - 4.6);
        raise(land, i, 1, PLAIN - 4);
        raise(land, i, -1, PLAIN - 4);
      }
    }
    // The water's face follows its bed down the drop.
    for (let i = 1; i <= 10; i += 1) {
      const chunk = MutableHashMap.get(land.chunks, keyOf(0, 0));
      if (chunk._tag === "Some") {
        chunk.value.surfaces[i] = PLAIN - 4.1;
      }
    }
    expect(surroundOf(land, 0.5, 0).fall).toBe(1);
    expect(surroundOf(land, -8, 0).fall).toBeGreaterThan(0);
    expect(surroundOf(land, -8, 0).fall).toBeLessThan(1);
  });

  it("hears a fire by how near it burns", () => {
    const land = plainOf(2);
    const spot = spotOf(-20, 9);
    MutableHashMap.set(land.things, keyOf(spot.cx, spot.cz), [
      { at: spot.at, kind: "campfire" as const, turn: 0 },
      { at: spot.at + 4, kind: "bench" as const, turn: 0 },
    ]);
    expect(surroundOf(land, -20, 9).fire).toBe(1);
    expect(surroundOf(land, -13, 9).fire).toBeCloseTo(0.5, 6);
    expect(surroundOf(land, 10, 9).fire).toBe(0);
  });
});
