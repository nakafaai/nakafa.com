// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import type { Thing } from "@repo/backend/confect/island/things";
import { Array as Arr, Option, Result } from "effect";
import { moved, pickUp, setDown, turned } from "@/lib/island/land/build";
import type { Change } from "@/lib/island/land/changes";
import { applyChanges, thingAt, undoneOf } from "@/lib/island/land/changes";
import { CHUNK, LIFT_STEPS } from "@/lib/island/land/chunk";
import { clearedOf } from "@/lib/island/land/edits";
import { floraOf } from "@/lib/island/land/flora";
import type { Land } from "@/lib/island/land/ground";
import { depthAt, heightAt, landOf } from "@/lib/island/land/ground";
import { homeOf } from "@/lib/island/land/home";
import { footprintOf, placeAt, spotOf } from "@/lib/island/land/site";

const SEED = 4242;

/** The lattice point every world of the seed opens on. */
const [HOME_X, HOME_Z] = homeOf(SEED);

/** Lattice points on rings about the seed's home, the nearest first. */
const AROUND = Arr.flatMap(Arr.range(0, 30), (ring) =>
  Arr.makeBy(Math.max(1, ring * 6), (slot) => {
    const turn = (slot / Math.max(1, ring * 6)) * Math.PI * 2;
    return [
      HOME_X + Math.round(Math.cos(turn) * ring * 4),
      HOME_Z + Math.round(Math.sin(turn) * ring * 4),
    ] as const;
  })
);

/** The nearest place to the seed's home that a test asks for. */
function placeWhere(test: (x: number, z: number) => boolean) {
  return Option.getOrThrow(Arr.findFirst(AROUND, ([x, z]) => test(x, z)));
}

/** The changes of one layer of the land's points among a step's. */
function pointsOf(step: readonly Change[], layer: "clear" | "lift") {
  return Arr.filter(
    step,
    (change): change is Extract<Change, { _tag: "point" }> =>
      change._tag === "point" && change.layer === layer
  );
}

/** What stands at the place of the half-block grid nearest a place. */
function standingAt(land: Land, x: number, z: number) {
  const spot = spotOf(x, z);
  return thingAt(land, spot.cx, spot.cz, spot.at);
}

/** The wild plants rooted within a rectangle about a place, read from the chunks about it. */
function plantsIn(
  land: Land,
  x: number,
  z: number,
  halfWidth: number,
  halfDepth: number
) {
  const [cx, cz] = [Math.floor(x / CHUNK), Math.floor(z / CHUNK)];
  return Arr.filter(
    Arr.flatMap(Arr.range(-1, 1), (dz) =>
      Arr.flatMap(Arr.range(-1, 1), (dx) => floraOf(land, cx + dx, cz + dz))
    ),
    (plant) =>
      Math.abs(plant.x - x) <= halfWidth && Math.abs(plant.z - z) <= halfDepth
  );
}

/** The ground's height at every lattice point under a thing's footprint. */
function floorOf(land: Land, kind: Thing, x: number, z: number) {
  const [halfWidth, halfDepth] = footprintOf(kind, 0);
  return Arr.flatMap(
    Arr.range(Math.ceil(z - halfDepth), Math.floor(z + halfDepth)),
    (j) =>
      Arr.map(
        Arr.range(Math.ceil(x - halfWidth), Math.floor(x + halfWidth)),
        (i) => heightAt(land, i, j)
      )
  );
}

/** How far the highest of some heights stands over the lowest. */
function spreadOf(heights: readonly number[]) {
  return Math.max(...heights) - Math.min(...heights);
}

/** A step that sets a thing down, applied to the land; the test fails where the land refuses it. */
function built(land: Land, kind: Thing, x: number, z: number, turn: number) {
  const step = Result.getOrThrow(setDown(land, kind, x, z, turn));
  applyChanges(land, step);
  return step;
}

describe("island/land/build", () => {
  it("sets a cottage down on ground it levels, where the wild plants make way, and takes all of it back as one step", () => {
    const land = landOf(SEED);
    const [halfWidth, halfDepth] = footprintOf("cottage", 0);
    const [x, z] = placeWhere((i, j) =>
      Result.match(setDown(land, "cottage", i, j, 0), {
        onFailure: () => false,
        onSuccess: (step) =>
          pointsOf(step, "clear").length > 0 &&
          spreadOf(floorOf(land, "cottage", i, j)) > 0.4,
      })
    );
    const spot = spotOf(x, z);
    const cottage = { at: spot.at, kind: "cottage", turn: 0 } as const;
    const before = floorOf(land, "cottage", x, z);
    const mean =
      Arr.reduce(before, 0, (sum, height) => sum + height) / before.length;
    const rooted = plantsIn(land, x, z, halfWidth + 0.5, halfDepth + 0.5);
    expect(rooted.length).toBeGreaterThan(0);
    const step = built(land, "cottage", x, z, 0);
    expect(Arr.last(step)).toEqual(
      Option.some({
        _tag: "thing",
        at: spot.at,
        cx: spot.cx,
        cz: spot.cz,
        from: Option.none(),
        to: Option.some(cottage),
      })
    );
    expect(thingAt(land, spot.cx, spot.cz, spot.at)).toEqual(
      Option.some(cottage)
    );
    for (const height of floorOf(land, "cottage", x, z)) {
      expect(Math.abs(height - mean)).toBeLessThanOrEqual(
        0.5 / LIFT_STEPS + 1e-5
      );
    }
    expect(pointsOf(step, "clear")).toHaveLength(rooted.length);
    for (const plant of rooted) {
      expect(clearedOf(land, plant.i, plant.j)).toBe(true);
    }
    expect(plantsIn(land, x, z, halfWidth + 0.5, halfDepth + 0.5)).toEqual([]);
    applyChanges(land, undoneOf(step));
    expect(thingAt(land, spot.cx, spot.cz, spot.at)).toEqual(Option.none());
    const after = floorOf(land, "cottage", x, z);
    expect(
      Arr.every(before, (height, at) => Math.abs(after[at] - height) < 1e-5)
    ).toBe(true);
    expect(
      Arr.map(
        plantsIn(land, x, z, halfWidth + 0.5, halfDepth + 0.5),
        (plant) => [plant.i, plant.j]
      )
    ).toEqual(Arr.map(rooted, (plant) => [plant.i, plant.j]));
  });

  it("leaves the ground as it lies under a thing that is no building, and under a bridge", () => {
    const land = landOf(SEED);
    const bench = Result.getOrThrow(setDown(land, "bench", HOME_X, HOME_Z, 1));
    expect(pointsOf(bench, "lift")).toEqual([]);
    expect(Arr.last(bench)).toEqual(
      Option.some({
        _tag: "thing",
        ...spotOf(HOME_X, HOME_Z),
        from: Option.none(),
        to: Option.some({
          at: spotOf(HOME_X, HOME_Z).at,
          kind: "bench",
          turn: 1,
        }),
      })
    );
    const [x, z] = placeWhere((i, j) => {
      const depth = depthAt(land, i, j);
      return depth > 0.05 && depth < 0.45;
    });
    const bridge = built(land, "bridge", x, z, 0);
    expect(pointsOf(bridge, "lift")).toEqual([]);
    expect(Option.map(standingAt(land, x, z), (thing) => thing.kind)).toEqual(
      Option.some("bridge")
    );
  });

  it("sets a thing down at the nearest place of the half-block grid, which then has no room for another", () => {
    const land = landOf(SEED);
    const [x, z] = placeWhere((i, j) =>
      Result.isSuccess(setDown(land, "well", i + 0.2, j - 0.2, 0))
    );
    const step = built(land, "well", x + 0.2, z - 0.2, 0);
    expect(placeAt(spotOf(x + 0.2, z - 0.2))).toEqual([x, z]);
    expect(standingAt(land, x, z)).toEqual(
      Option.some({ at: spotOf(x, z).at, kind: "well", turn: 0 })
    );
    // The well is a building: the ground about the place it landed on is levelled, not the ground about the press.
    const lifts = pointsOf(step, "lift");
    expect(
      Arr.every(
        lifts,
        (change) => Math.abs(change.i - x) <= 3 && Math.abs(change.j - z) <= 2
      )
    ).toBe(true);
    expect(setDown(land, "well", x - 0.2, z + 0.2, 1)).toEqual(
      Result.fail("room")
    );
  });

  it("says why a thing cannot be set down, and changes nothing", () => {
    const land = landOf(SEED);
    const [x, z] = placeWhere((i, j) => depthAt(land, i, j) > 1);
    expect(setDown(land, "cottage", x, z, 0)).toEqual(Result.fail("dry"));
    expect(setDown(land, "boat", HOME_X, HOME_Z, 0)).toEqual(
      Result.fail("water")
    );
    built(land, "bench", HOME_X, HOME_Z, 0);
    expect(setDown(land, "lantern", HOME_X, HOME_Z, 0)).toEqual(
      Result.fail("room")
    );
    expect(
      Option.map(standingAt(land, HOME_X, HOME_Z), (thing) => thing.kind)
    ).toEqual(Option.some("bench"));
  });

  it("takes a thing away in one step, and nothing where nothing stands", () => {
    const land = landOf(SEED);
    const spot = spotOf(HOME_X, HOME_Z);
    expect(pickUp(land, spot)).toEqual([]);
    built(land, "bench", HOME_X, HOME_Z, 2);
    const step = pickUp(land, spot);
    expect(step).toEqual([
      {
        _tag: "thing",
        ...spot,
        from: Option.some({ at: spot.at, kind: "bench", turn: 2 }),
        to: Option.none(),
      },
    ]);
    applyChanges(land, step);
    expect(thingAt(land, spot.cx, spot.cz, spot.at)).toEqual(Option.none());
    applyChanges(land, undoneOf(step));
    expect(thingAt(land, spot.cx, spot.cz, spot.at)).toEqual(
      Option.some({ at: spot.at, kind: "bench", turn: 2 })
    );
  });

  it("turns a thing a quarter where it stands, a full turn in four, and refuses a turn into a neighbour", () => {
    const land = landOf(SEED);
    const spot = spotOf(HOME_X, HOME_Z);
    expect(turned(land, spot)).toEqual(Result.succeed([]));
    built(land, "bench", HOME_X, HOME_Z, 0);
    const turns = Arr.map(Arr.range(1, 4), () => {
      applyChanges(land, Result.getOrThrow(turned(land, spot)));
      return Option.getOrThrow(thingAt(land, spot.cx, spot.cz, spot.at)).turn;
    });
    expect(turns).toEqual([1, 2, 3, 0]);
    // A lantern beside the bench's long side has room, and stands where the bench's end would swing to.
    built(land, "lantern", HOME_X, HOME_Z + 0.5, 0);
    expect(turned(land, spot)).toEqual(Result.fail("room"));
    expect(
      Option.getOrThrow(thingAt(land, spot.cx, spot.cz, spot.at)).turn
    ).toBe(0);
  });

  it("moves a thing to a new place in one step, its own footprint out of its way, and levels the ground a building moves onto", () => {
    const land = landOf(SEED);
    const [x, z] = placeWhere(
      (i, j) =>
        Result.isSuccess(setDown(land, "cottage", i, j, 0)) &&
        Result.isSuccess(setDown(land, "cottage", i + 8, j, 0)) &&
        spreadOf(floorOf(land, "cottage", i + 8, j)) > 0.3
    );
    const from = spotOf(x, z);
    expect(moved(land, from, x + 8, z)).toEqual(Result.succeed([]));
    built(land, "cottage", x, z, 2);
    // Half a block aside the cottage would stand in its own footprint, which does not count.
    expect(Result.isSuccess(moved(land, from, x + 0.5, z))).toBe(true);
    const step = Result.getOrThrow(moved(land, from, x + 8, z));
    const to = spotOf(x + 8, z);
    expect(Arr.head(step)).toEqual(
      Option.some({
        _tag: "thing",
        ...from,
        from: Option.some({ at: from.at, kind: "cottage", turn: 2 }),
        to: Option.none(),
      })
    );
    expect(Arr.last(step)).toEqual(
      Option.some({
        _tag: "thing",
        ...to,
        from: Option.none(),
        to: Option.some({ at: to.at, kind: "cottage", turn: 2 }),
      })
    );
    expect(pointsOf(step, "lift").length).toBeGreaterThan(0);
    applyChanges(land, step);
    expect(standingAt(land, x, z)).toEqual(Option.none());
    expect(standingAt(land, x + 8, z)).toEqual(
      Option.some({ at: to.at, kind: "cottage", turn: 2 })
    );
    expect(spreadOf(floorOf(land, "cottage", x + 8, z))).toBeLessThanOrEqual(
      1 / LIFT_STEPS + 1e-5
    );
    // Taken back, the cottage stands where it stood.
    applyChanges(land, undoneOf(step));
    expect(standingAt(land, x, z)).toEqual(
      Option.some({ at: from.at, kind: "cottage", turn: 2 })
    );
    expect(standingAt(land, x + 8, z)).toEqual(Option.none());
  });

  it("says why a thing cannot move to a place, and leaves it where it stands", () => {
    const land = landOf(SEED);
    const spot = spotOf(HOME_X, HOME_Z);
    built(land, "bench", HOME_X, HOME_Z, 0);
    const [x, z] = placeWhere((i, j) => depthAt(land, i, j) > 1);
    expect(moved(land, spot, x, z)).toEqual(Result.fail("dry"));
    built(land, "lantern", HOME_X - 3, HOME_Z, 0);
    expect(moved(land, spot, HOME_X - 3, HOME_Z)).toEqual(Result.fail("room"));
    expect(
      Option.map(standingAt(land, HOME_X, HOME_Z), (thing) => thing.kind)
    ).toEqual(Option.some("bench"));
  });
});
