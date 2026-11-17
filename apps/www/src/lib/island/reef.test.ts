// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr } from "effect";
import { BODY_STRIDE } from "@/lib/island/bodies";
import { LOOKS } from "@/lib/island/models/reef";
import { reefBodies, reefOf } from "@/lib/island/reef";
import { DEEP, outOf, terrainOf } from "@/lib/island/terrain";
import { cellOf, SEA_LEVEL } from "@/lib/island/world";

/** A level 1 island's footprint and a smaller one whose whole reef lies in the world's own cells. */
const SIZES = [52, 30] as const;

/** Whether (x, z) lies in the world's own cells. */
const isOwn = (x: number, z: number) =>
  x >= 0 && x < SPAN && z >= 0 && z < SPAN;

describe("island/reef", () => {
  it("grows each kind in its own zone out from the shore, and lily pads only on the pond", () => {
    Arr.forEach(SIZES, (size) => {
      const spots = reefOf(terrainOf(7, size), 7, size);
      Arr.forEach(spots, (spot) => {
        const [x, z] = [Math.floor(spot.x), Math.floor(spot.z)];
        const out = outOf(7, size, x, z);
        if (!isOwn(x, z)) {
          expect(["kelp", "sponge", "fan"]).toContain(spot.kind);
          expect(spot.y).toBe(SEA_LEVEL - DEEP);
          return;
        }
        const zone = {
          anemone: [3, 9],
          branching: [3, 9],
          brain: [3, 9],
          fan: [7, 15],
          kelp: [9, 15],
          lily: [-99, 0],
          seagrass: [3, 7],
          sponge: [7, 15],
          table: [7, 9],
        }[spot.kind];
        expect(out).toBeGreaterThanOrEqual(zone[0]);
        expect(out).toBeLessThan(zone[1]);
        expect(spot.y).toBe(
          spot.kind === "lily" ? SEA_LEVEL - 0.125 : Math.round(spot.y)
        );
      });
    });
  });

  it("makes a rich reef: every kind in every look, each turned its own way, and the same from the same seed", () => {
    const spots = reefOf(terrainOf(7, 52), 7, 52);
    const kinds = Arr.dedupe(Arr.map(spots, (spot) => spot.kind));
    expect(kinds).toHaveLength(9);
    expect(
      Arr.dedupe(Arr.map(spots, (spot) => `${spot.kind}-${spot.look}`))
    ).toHaveLength(9 * LOOKS);
    expect(spots.length).toBeGreaterThan(200);
    const yaws = Arr.map(
      Arr.filter(spots, (spot) => spot.kind === "kelp"),
      (spot) => spot.yaw.toFixed(3)
    );
    expect(Arr.dedupe(yaws).length).toBeGreaterThan(yaws.length * 0.95);
    expect(reefOf(terrainOf(7, 52), 7, 52)).toEqual(spots);
  });

  it("stands every sea fan square to the current", () => {
    const fans = Arr.filter(
      reefOf(terrainOf(11, 30), 11, 30),
      (spot) => spot.kind === "fan"
    );
    expect(fans.length).toBeGreaterThan(0);
    Arr.forEach(fans, (fan) =>
      expect(Math.abs(fan.yaw)).toBeLessThanOrEqual(0.25)
    );
  });

  it("clears the reef from a column the learner has built over or dug out", () => {
    const cells = terrainOf(7, 30);
    const before = reefOf(cells, 7, 30);
    const [first, second] = Arr.filter(
      before,
      (spot) => spot.kind !== "lily" && isOwn(spot.x, spot.z)
    );
    const [ax, az] = [Math.floor(first.x), Math.floor(first.z)];
    const [bx, bz] = [Math.floor(second.x), Math.floor(second.z)];
    cells[cellOf(ax, first.y, az)] = idOf("stone");
    cells[cellOf(bx, second.y - 1, bz)] = 0;
    const after = reefOf(cells, 7, 30);
    expect(after).toHaveLength(before.length - 2);
  });

  it("draws the reef as one model a kind and look, each with its bodies' places", () => {
    const spots = reefOf(terrainOf(7, 52), 7, 52);
    const bodies = reefBodies(spots);
    expect(bodies).toHaveLength(9 * LOOKS);
    const total = Arr.reduce(bodies, 0, (sum, [model, places]) => {
      expect(model._tag).toBe("reef");
      expect(places.length % BODY_STRIDE).toBe(0);
      return sum + places.length / BODY_STRIDE;
    });
    expect(total).toBe(spots.length);
  });
});
