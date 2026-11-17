// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { Array as Arr, Option } from "effect";
import { BODY_STRIDE } from "@/lib/island/bodies";
import { SPECIES } from "@/lib/island/fauna/species";
import { ballAt, hunterAt } from "@/lib/island/hunt";
import { reefOf } from "@/lib/island/reef";
import { schoolBodies } from "@/lib/island/schools";
import { outOf, terrainOf } from "@/lib/island/terrain";
import { cellOf, emptyCells, SEA_LEVEL } from "@/lib/island/world";

const CELLS = terrainOf(7, 30);
const SPOTS = reefOf(CELLS, 7, 30);

/** The bodies of one species at `time`, each as its run of numbers. */
const fishOf = (key: string, time: number) =>
  Arr.findFirst(
    schoolBodies(CELLS, 7, 30, SPOTS, time),
    ([model]) => model._tag === "species" && SPECIES[model.index].key === key
  ).pipe(
    Option.map(([, places]) => Arr.chunksOf(Array.from(places), BODY_STRIDE)),
    Option.getOrElse(() => [])
  );

describe("island/schools", () => {
  it("keeps a school of each reef resident over the reef crest every day, under the sea and over its floor", () => {
    Arr.forEach(["blue-tang", "snapper", "angelfish"], (key) => {
      const school = fishOf(key, 12);
      expect(school.length).toBeGreaterThan(2);
      Arr.forEach(school, ([x, y, z]) => {
        expect(y).toBeLessThan(SEA_LEVEL - 0.2);
        const out = outOf(7, 30, Math.floor(x), Math.floor(z));
        expect(out).toBeGreaterThan(4);
        expect(out).toBeLessThan(12);
      });
    });
    // A school moves on along the crest, the snapper the other way round.
    expect(fishOf("blue-tang", 20)[0][0]).not.toBeCloseTo(
      fishOf("blue-tang", 12)[0][0]
    );
  });

  it("keeps a pair of clownfish close over each anemone", () => {
    const anemones = Arr.filter(SPOTS, (spot) => spot.kind === "anemone");
    const clowns = fishOf("clownfish", 3);
    expect(clowns).toHaveLength(Math.min(10, anemones.length) * 2);
    Arr.forEach(Arr.chunksOf(clowns, 2), (pair, order) => {
      const home = anemones[order];
      Arr.forEach(pair, ([x, y, z]) => {
        expect(Math.hypot(x - home.x, z - home.z)).toBeLessThan(0.25);
        expect(y).toBeGreaterThan(home.y);
      });
    });
  });

  it("mills the bait ball round its middle and bursts it apart when the reef shark charges", () => {
    const spread = (time: number) => {
      const ball = ballAt(7, time);
      const fish = fishOf("mackerel", time);
      expect(fish).toHaveLength(16);
      return Math.max(
        ...Arr.map(fish, ([x, , z]) => Math.hypot(x - ball.x, z - ball.z))
      );
    };
    expect(spread(16.2)).toBeGreaterThan(spread(8) + 1);
    // Every mackerel swims across the ball, round its middle, not out of it.
    const ball = ballAt(7, 8);
    Arr.forEach(fishOf("mackerel", 8), ([x, , z, yaw]) => {
      const radial = Math.atan2(x - ball.x, z - ball.z);
      expect(Math.abs(Math.cos(yaw - radial))).toBeLessThan(0.01);
    });
    expect(hunterAt(7, 8).y).toBe(ball.y);
  });

  it("leaves a fish out where the water is too shallow for it, and holds it at its depth where no floor lies under it", () => {
    const shallow = emptyCells();
    Arr.forEach(
      Arr.makeBy(64 * 64, (column) => column),
      (column) => {
        shallow[cellOf(column % 64, SEA_LEVEL - 1, Math.floor(column / 64))] =
          idOf("sand");
      }
    );
    const tangs = (cells: Uint8Array, size: number) =>
      Arr.findFirst(
        schoolBodies(cells, 7, size, [], 12),
        ([model]) =>
          model._tag === "species" && SPECIES[model.index].key === "blue-tang"
      ).pipe(
        Option.map(([, places]) => places.length),
        Option.getOrElse(() => -1)
      );
    expect(tangs(shallow, 30)).toBe(0);
    // Out past the world's own cells only the deep plane lies, so the school keeps its own depth there.
    expect(tangs(emptyCells(), 52)).toBe(8 * 6);
  });
});
