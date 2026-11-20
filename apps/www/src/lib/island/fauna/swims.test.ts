// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Order } from "effect";
import { CELL, surveyOf } from "@/lib/island/fauna/habitat";
import {
  draughtOf,
  swimBodies,
  swimsOf,
  whaleAt,
} from "@/lib/island/fauna/swims";
import { hunterAt } from "@/lib/island/hunt";
import { SEA } from "@/lib/island/land/relief";
import { modelKey } from "@/lib/island/models/kinds";
import { floodAll, plainOf } from "@/lib/island/test.world";

/** A whale on a round of twenty blocks about a place of deep water. */
const WHALE = { _tag: "whale", radius: 20, start: 0, x: 300, z: 100 } as const;

/** A cell of sea `depth` blocks deep with a margin of the same sea round it, and the places of open sea it offers. */
function seaOf(depth: number) {
  const land = plainOf(2);
  floodAll(land, [-32, -32], [96, 96], depth, "sea");
  return { land, spots: surveyOf(land, 0, 0).sea };
}

/** The swimmer each of many cells of one sea holds, by its kind. */
function castOf(depth: number) {
  const { land, spots } = seaOf(depth);
  return Arr.flatMap(Arr.range(0, 80), (gx) =>
    Arr.map(swimsOf(land, spots, { day: 1, gx, gz: 0, seed: 9 }), (swim) =>
      swim._tag === "pod" ? swim.kind : swim._tag
    )
  );
}

describe("island/fauna/swims", () => {
  it("swims the whale a slow round about its place, its back breaking the sea, facing its way", () => {
    Arr.forEach([30, 31, 40], (time) => {
      const at = whaleAt(WHALE, time);
      expect(Math.hypot(at.x - 300, at.z - 100)).toBeCloseTo(20, 6);
      expect(at.y).toBeLessThanOrEqual(SEA + 0.1);
      expect(at.y).toBeGreaterThanOrEqual(SEA - 0.8);
      expect(at.pitch).toBe(0);
      const later = whaleAt(WHALE, time + 0.01);
      expect(Math.atan2(later.x - at.x, later.z - at.z)).toBeCloseTo(at.yaw, 2);
    });
  });

  it("breaches the whale once a cycle: a dive, a launch nose up clear of the sea, a fall back flat, and its round again", () => {
    // The first breach begins twenty seconds in, and each whale's at a moment of its own.
    const dip = whaleAt(WHALE, 20.6);
    expect(dip.pitch).toBeLessThan(0);
    const turned = whaleAt(WHALE, 22.6);
    expect(turned.pitch).toBeGreaterThan(0.8);
    expect(turned.y).toBeLessThan(SEA - 2);
    const heights = Arr.map(Arr.range(0, 60), (step) =>
      whaleAt(WHALE, 23 + step * 0.05)
    );
    const top = Math.max(...Arr.map(heights, (at) => at.y));
    expect(top).toBeGreaterThan(SEA + 2);
    expect(top).toBeLessThan(SEA + 2.6);
    expect(whaleAt(WHALE, 23.2).pitch).toBe(1.25);
    expect(whaleAt(WHALE, 25.1).pitch).toBe(-0.5);
    const easing = whaleAt(WHALE, 27);
    expect(easing.pitch).toBeLessThan(0);
    expect(easing.pitch).toBeGreaterThan(-0.5);
    expect(whaleAt(WHALE, 31).pitch).toBe(0);
    expect(whaleAt(WHALE, 20.6 + 46).pitch).toBeCloseTo(dip.pitch, 6);
    expect(whaleAt({ ...WHALE, start: 2 }, 20.6).pitch).toBe(0);
  });

  it("draws each big swimmer with its model: a whale, a pod abreast on its round, a dolphin that leaps, and the reef shark on its hunt", () => {
    const hunt = { lane: 5, seed: 3, x: 0, y: SEA - 2, z: 0 };
    const pod = { radius: 14, start: 1, x: 50, z: 50 } as const;
    const bodies = swimBodies(
      [
        WHALE,
        { _tag: "pod", kind: "orca", ...pod },
        { _tag: "pod", kind: "dolphin", ...pod },
        { _tag: "hunter", hunt },
      ],
      3
    );
    expect(Arr.map(bodies, ([model]) => modelKey(model))).toEqual([
      "body-whale",
      "swimmer-orca",
      "swimmer-dolphin",
      "swimmer-reef-shark",
    ]);
    expect(Arr.map(bodies, ([, places]) => places.length / 6)).toEqual([
      1, 2, 3, 1,
    ]);
    const orcas = Arr.chunksOf(Arr.fromIterable(bodies[1][1]), 6);
    // Two orcas swim abreast, 3.2 blocks apart, under the sea, level.
    expect(
      Math.hypot(orcas[0][0] - 50, orcas[0][2] - 50) -
        Math.hypot(orcas[1][0] - 50, orcas[1][2] - 50)
    ).toBeCloseTo(-3.2, 5);
    expect(orcas[0][1]).toBeCloseTo(SEA - 1.3, 5);
    expect(orcas[0][5]).toBe(0);
    const shark = hunterAt(hunt, 3);
    expect(bodies[3][1][0]).toBeCloseTo(shark.x, 5);
    // Over a few seconds every dolphin leaves the sea nose up, comes down nose down, and swims under it between.
    const leaps = Arr.flatMap(Arr.range(0, 140), (step) =>
      Arr.chunksOf(
        Arr.fromIterable(
          swimBodies(
            [{ _tag: "pod", kind: "dolphin", ...pod }],
            step * 0.05
          )[0][1]
        ),
        6
      )
    );
    expect(Math.max(...Arr.map(leaps, (at) => at[1]))).toBeGreaterThan(SEA + 1);
    expect(Math.min(...Arr.map(leaps, (at) => at[1]))).toBeCloseTo(
      SEA - 0.7,
      5
    );
    expect(Math.max(...Arr.map(leaps, (at) => at[5]))).toBeGreaterThan(0.2);
    expect(Math.min(...Arr.map(leaps, (at) => at[5]))).toBeLessThan(-0.2);
  });

  it("gives every cell of deep sea one big swimmer of the seed's choosing, each kind somewhere", () => {
    const cast = castOf(9);
    expect(cast).toHaveLength(81);
    expect(Arr.sort(Arr.dedupe(cast), Order.String)).toEqual([
      "dolphin",
      "hammerhead",
      "hunter",
      "orca",
      "tiger-shark",
      "whale",
      "whale-shark",
    ]);
    const { land, spots } = seaOf(9);
    const dice = { day: 1, gx: 4, gz: 2, seed: 9 };
    expect(swimsOf(land, spots, dice)).toEqual(swimsOf(land, spots, dice));
    expect(swimsOf(land, spots, { ...dice, day: 2 })).toEqual(
      swimsOf(land, spots, dice)
    );
  });

  it("holds no swimmer where the sea is too small or too shallow for its round, and keeps every round over deep water", () => {
    const { land, spots } = seaOf(9);
    expect(
      swimsOf(land, Arr.take(spots, 23), { day: 1, gx: 0, gz: 0, seed: 9 })
    ).toEqual([]);
    // A sea four blocks deep carries dolphins, sharks and the hunt, never a whale.
    const shallow = castOf(4);
    expect(shallow).not.toContain("whale");
    expect(shallow).toContain("dolphin");
    expect(shallow).toContain("hunter");
    expect(shallow.length).toBeLessThan(81);
    expect(castOf(3.2)).not.toContain("hunter");
    expect(draughtOf("whale")).toBe(6);
    expect(draughtOf("dolphin")).toBeCloseTo(1.9, 6);
    // A bay too narrow for the widest round gets a narrower one.
    const bay = plainOf(2);
    floodAll(bay, [8, 8], [56, 56], 9, "sea");
    const rounds = Arr.flatMap(Arr.range(0, 80), (gx) =>
      swimsOf(bay, surveyOf(bay, 0, 0).sea, { day: 1, gx, gz: 0, seed: 9 })
    );
    expect(rounds.length).toBeGreaterThan(0);
    for (const swim of rounds) {
      if (swim._tag !== "hunter") {
        expect(swim.radius).toBeLessThan(20);
        expect(swim.x).toBeGreaterThan(8);
        expect(swim.x).toBeLessThan(CELL - 8);
      }
    }
  });
});
