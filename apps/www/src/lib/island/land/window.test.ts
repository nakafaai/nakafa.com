// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, MutableHashMap, Option } from "effect";
import { LIFT_STEPS, PAINT } from "@/lib/island/land/chunk";
import { setLift, setPaint } from "@/lib/island/land/edits";
import { flowAt, heightAt, landOf, surfaceAt } from "@/lib/island/land/ground";
import { pointOf } from "@/lib/island/land/relief";
import {
  fillHorizon,
  fillWindow,
  HORIZON_STEP,
  horizonOf,
  originOf,
  SEAM,
  WINDOW,
  windowOf,
} from "@/lib/island/land/window";

const SEED = 4242;

/** A window's origin west and north of the world's own, on neither axis at a chunk's edge. */
const ORIGIN = originOf(-50, -210);

/** The land of the seed with a path the learner laid, and the window filled about `ORIGIN` once for every test that reads it. */
const land = landOf(SEED);
setPaint(land, ORIGIN[0] + 5, ORIGIN[1] - 9, PAINT.path);
const filled = windowOf();
fillWindow(land, filled, ORIGIN);

/** Where a lattice point lies in a window about `ORIGIN`. */
function slotOf(i: number, j: number) {
  return (
    ((j - ORIGIN[1] + WINDOW / 2) * WINDOW + (i - ORIGIN[0] + WINDOW / 2)) * 4
  );
}

/** Lattice points spread over the whole window, its first and last rows and columns among them. */
const SAMPLES = Arr.flatMap(Arr.range(0, 15), (row) =>
  Arr.map(
    Arr.range(0, 15),
    (column) =>
      [
        ORIGIN[0] - WINDOW / 2 + column * 17,
        ORIGIN[1] - WINDOW / 2 + row * 17,
      ] as const
  )
);

describe("island/land/window", () => {
  it("holds the window to steps, so a pan fills it again only once in a while", () => {
    expect(ORIGIN).toEqual([-48, -208]);
    expect(originOf(7, 9)).toEqual([0, 16]);
    expect(originOf(-9, 24.1)).toEqual([-16, 32]);
    expect(horizonOf(-100, -300)).toEqual([-128, -320]);
    expect(horizonOf(31, 33)).toEqual([0, 64]);
    expect(SEAM).toBeLessThan(WINDOW / 2);
  });

  it("holds at every lattice point about a negative origin the ground, the water and the river's run the land reads there", () => {
    // The last sample is the window's last lattice point either way.
    expect(Arr.last(SAMPLES)).toEqual(
      Option.some([ORIGIN[0] + WINDOW / 2 - 1, ORIGIN[1] + WINDOW / 2 - 1])
    );
    for (const [i, j] of SAMPLES) {
      const at = slotOf(i, j);
      const flow = flowAt(land, i, j);
      expect(filled.fields[at]).toBe(heightAt(land, i, j));
      expect(filled.fields[at + 1]).toBe(surfaceAt(land, i, j));
      expect(filled.fields[at + 2]).toBe(Math.fround(flow[0]));
      expect(filled.fields[at + 3]).toBe(Math.fround(flow[1]));
    }
    expect(Arr.some(SAMPLES, ([i, j]) => i < 0 && j < 0)).toBe(true);
    expect(Arr.some(SAMPLES, ([i]) => i > 0)).toBe(true);
  });

  it("holds what covers the ground: the learner's path, the sea's sand, and the land's own woods and meadows", () => {
    const path = slotOf(ORIGIN[0] + 5, ORIGIN[1] - 9);
    expect(filled.kinds[path]).toBe(255);
    expect(filled.kinds[path + 4]).toBe(0);
    const covers = Arr.map(SAMPLES, ([i, j]) => {
      const at = slotOf(i, j);
      const point = pointOf(SEED, i, j);
      return {
        meadow: filled.kinds[at + 2],
        point,
        sand: filled.kinds[at + 1],
        wood: filled.kinds[at + 3],
      };
    });
    for (const cover of covers) {
      expect(cover.sand).toBe(Math.round(cover.point.sand * 255));
      expect(cover.meadow).toBe(Math.round(cover.point.meadow * 255));
    }
    expect(Arr.some(covers, (cover) => cover.sand === 255)).toBe(true);
    expect(Arr.some(covers, (cover) => cover.sand === 0)).toBe(true);
    const wooded = Arr.filter(covers, (cover) => cover.point.forest > 0.9);
    const open = Arr.filter(
      covers,
      (cover) => cover.point.forest === 0 && cover.point.moist < 0.4
    );
    expect(wooded.length).toBeGreaterThan(0);
    expect(open.length).toBeGreaterThan(0);
    expect(Math.min(...Arr.map(wooded, (cover) => cover.wood))).toBeGreaterThan(
      Math.max(...Arr.map(open, (cover) => cover.wood))
    );
  });

  it("shows a change to the land as soon as the window is filled again", () => {
    const [i, j] = [ORIGIN[0] - 100, ORIGIN[1] + 100];
    const before = filled.fields[slotOf(i, j)];
    setLift(land, i, j, 20);
    expect(filled.fields[slotOf(i, j)]).toBe(before);
    fillWindow(land, filled, ORIGIN);
    expect(filled.fields[slotOf(i, j)]).toBeCloseTo(
      before + 20 / LIFT_STEPS,
      5
    );
    setLift(land, i, j, 0);
    fillWindow(land, filled, ORIGIN);
    expect(filled.fields[slotOf(i, j)]).toBeCloseTo(before, 5);
  });

  it("fills only the rows of the horizon it is asked for, from the seed and the learner's lifts", () => {
    const far = landOf(SEED);
    const origin = horizonOf(-100, -300);
    const placeOf = (row: number, column: number) =>
      [
        origin[0] + (column - WINDOW / 2) * HORIZON_STEP,
        origin[1] + (row - WINDOW / 2) * HORIZON_STEP,
      ] as const;
    const [liftedX, liftedZ] = placeOf(3, 10);
    setLift(far, liftedX, liftedZ, 24);
    const made = MutableHashMap.size(far.chunks);
    const horizon = windowOf();
    fillHorizon(far, horizon, origin, 3, 5);
    // The horizon reads the seed, not the chunks, so its quarter of a million blocks make none.
    expect(MutableHashMap.size(far.chunks)).toBe(made);
    const rowOf = (row: number) => ({
      fields: horizon.fields.subarray(row * WINDOW * 4, (row + 1) * WINDOW * 4),
      kinds: horizon.kinds.subarray(row * WINDOW * 4, (row + 1) * WINDOW * 4),
    });
    for (const row of [0, 2, 5, WINDOW - 1]) {
      expect(rowOf(row).fields.every((value) => value === 0)).toBe(true);
      expect(rowOf(row).kinds.every((value) => value === 0)).toBe(true);
    }
    for (const row of [3, 4]) {
      for (const column of Arr.range(0, WINDOW - 1)) {
        const [x, z] = placeOf(row, column);
        const point = pointOf(SEED, x, z);
        const at = (row * WINDOW + column) * 4;
        const lift = row === 3 && column === 10 ? 24 / LIFT_STEPS : 0;
        expect(horizon.fields[at]).toBe(Math.fround(point.height + lift));
        expect(horizon.fields[at + 1]).toBe(Math.fround(point.surface));
        expect(horizon.fields[at + 2]).toBe(0);
        expect(horizon.fields[at + 3]).toBe(0);
        expect(horizon.kinds[at]).toBe(0);
        expect(horizon.kinds[at + 1]).toBe(Math.round(point.sand * 255));
        expect(horizon.kinds[at + 2]).toBe(Math.round(point.meadow * 255));
      }
    }
    expect(placeOf(3, 10)).toEqual([-1072, -1320]);
    // The next rows of the same horizon leave the rows already filled as they are.
    const kept = rowOf(3).fields.slice();
    fillHorizon(far, horizon, origin, 5, 6);
    fillHorizon(far, horizon, origin, 6, 6);
    expect(rowOf(3).fields).toEqual(kept);
    expect(rowOf(5).fields.some((value) => value !== 0)).toBe(true);
    expect(rowOf(6).fields.every((value) => value === 0)).toBe(true);
  });

  it("marks the woods of the horizon as the window marks its own", () => {
    const far = landOf(SEED);
    const horizon = windowOf();
    fillHorizon(far, horizon, [0, 0], 120, 136);
    const points = Arr.flatMap(Arr.range(120, 135), (row) =>
      Arr.map(Arr.range(0, WINDOW - 1), (column) => {
        const point = pointOf(
          SEED,
          (column - WINDOW / 2) * HORIZON_STEP,
          (row - WINDOW / 2) * HORIZON_STEP
        );
        return { point, wood: horizon.kinds[(row * WINDOW + column) * 4 + 3] };
      })
    );
    const wooded = Arr.filter(points, ({ point }) => point.forest > 0.9);
    const open = Arr.filter(
      points,
      ({ point }) => point.forest === 0 && point.moist < 0.4
    );
    expect(wooded.length).toBeGreaterThan(0);
    expect(open.length).toBeGreaterThan(0);
    expect(Math.min(...Arr.map(wooded, ({ wood }) => wood))).toBeGreaterThan(
      Math.max(...Arr.map(open, ({ wood }) => wood))
    );
  });
});
