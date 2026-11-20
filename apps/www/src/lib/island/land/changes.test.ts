// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, HashSet, MutableHashMap, Option } from "effect";
import type { Change } from "@/lib/island/land/changes";
import {
  applyChanges,
  joinedOf,
  pointTo,
  thingAt,
  thingTo,
  undoneOf,
} from "@/lib/island/land/changes";
import { keyOf, PAINT } from "@/lib/island/land/chunk";
import { clearedOf, liftOf, paintOf } from "@/lib/island/land/edits";
import { heightAt, landOf } from "@/lib/island/land/ground";
import { homeOf } from "@/lib/island/land/home";
import { dabChanges } from "@/lib/island/land/stroke";

const SEED = 4242;

/** The lattice point every world of the seed opens on. */
const [HOME_X, HOME_Z] = homeOf(SEED);

/** The lattice points a stroke along the home's row can reach, with the ground's height at each. */
function heightsOf(land: ReturnType<typeof landOf>) {
  return Arr.flatMap(Arr.range(-4, 4), (dz) =>
    Arr.map(Arr.range(-4, 10), (dx) => heightAt(land, HOME_X + dx, HOME_Z + dz))
  );
}

describe("island/land/changes", () => {
  it("names a change of a point only where the point would change, with what it held", () => {
    const land = landOf(SEED);
    expect(pointTo(land, "lift", 7, -3, 0)).toEqual(Option.none());
    expect(pointTo(land, "paint", 7, -3, PAINT.none)).toEqual(Option.none());
    expect(pointTo(land, "clear", 7, -3, 0)).toEqual(Option.none());
    expect(pointTo(land, "lift", 7, -3, 5)).toEqual(
      Option.some({ _tag: "point", from: 0, i: 7, j: -3, layer: "lift", to: 5 })
    );
    applyChanges(land, Option.toArray(pointTo(land, "clear", 7, -3, 1)));
    expect(pointTo(land, "clear", 7, -3, 1)).toEqual(Option.none());
    expect(pointTo(land, "clear", 7, -3, 0)).toEqual(
      Option.some({
        _tag: "point",
        from: 1,
        i: 7,
        j: -3,
        layer: "clear",
        to: 0,
      })
    );
  });

  it("writes every layer of a point, and takes a step back with its last change first", () => {
    const land = landOf(SEED);
    const before = heightAt(land, HOME_X, HOME_Z);
    const made = Arr.flatMap(
      [
        ["lift", 6],
        ["paint", PAINT.path],
        ["clear", 1],
        ["lift", 10],
      ] as const,
      ([layer, to]) => {
        const changes = Option.toArray(
          pointTo(land, layer, HOME_X, HOME_Z, to)
        );
        applyChanges(land, changes);
        return changes;
      }
    );
    expect(made).toHaveLength(4);
    expect(liftOf(land, HOME_X, HOME_Z)).toBe(10);
    expect(paintOf(land, HOME_X, HOME_Z)).toBe(PAINT.path);
    expect(clearedOf(land, HOME_X, HOME_Z)).toBe(true);
    applyChanges(land, undoneOf(made));
    expect(liftOf(land, HOME_X, HOME_Z)).toBe(0);
    expect(paintOf(land, HOME_X, HOME_Z)).toBe(PAINT.none);
    expect(clearedOf(land, HOME_X, HOME_Z)).toBe(false);
    expect(heightAt(land, HOME_X, HOME_Z)).toBeCloseTo(before, 5);
  });

  it("sets a thing at a place, replaces what stood there, takes it away, and puts each back", () => {
    const land = landOf(SEED);
    const bench = { at: 130, kind: "bench", turn: 1 } as const;
    const lantern = { at: 130, kind: "lantern", turn: 0 } as const;
    expect(thingAt(land, -2, 5, 130)).toEqual(Option.none());
    const set = thingTo(land, -2, 5, 130, Option.some(bench));
    expect(set.from).toEqual(Option.none());
    applyChanges(land, [set]);
    expect(thingAt(land, -2, 5, 130)).toEqual(Option.some(bench));
    expect(thingAt(land, -2, 5, 131)).toEqual(Option.none());
    const replaced = thingTo(land, -2, 5, 130, Option.some(lantern));
    expect(replaced.from).toEqual(Option.some(bench));
    const beside = thingTo(
      land,
      -2,
      5,
      140,
      Option.some({ ...bench, at: 140 })
    );
    applyChanges(land, [replaced, beside]);
    expect(MutableHashMap.get(land.things, keyOf(-2, 5))).toEqual(
      Option.some([lantern, { ...bench, at: 140 }])
    );
    const taken = thingTo(land, -2, 5, 130, Option.none());
    applyChanges(land, [taken]);
    expect(thingAt(land, -2, 5, 130)).toEqual(Option.none());
    expect(thingAt(land, -2, 5, 140)).toEqual(
      Option.some({ ...bench, at: 140 })
    );
    applyChanges(land, undoneOf([taken]));
    expect(thingAt(land, -2, 5, 130)).toEqual(Option.some(lantern));
    applyChanges(land, undoneOf([replaced, beside]));
    expect(MutableHashMap.get(land.things, keyOf(-2, 5))).toEqual(
      Option.some([bench])
    );
  });

  it("joins the dabs of one stroke into one step that names each point once, and whose undo restores every point", () => {
    const land = landOf(SEED);
    const before = heightsOf(land);
    const dabs = Arr.makeBy(13, (dab) => HOME_X + dab * 0.5);
    const none: readonly Change[] = [];
    const step = Arr.reduce(dabs, none, (joined, x) => {
      const changes = dabChanges(land, "raise", x, HOME_Z, 0);
      applyChanges(land, changes);
      return joinedOf(joined, changes);
    });
    const subjects = HashSet.fromIterable(
      Arr.map(step, (change) =>
        change._tag === "point" ? `${change.i}:${change.j}` : "thing"
      )
    );
    expect(HashSet.size(subjects)).toBe(step.length);
    expect(step.length).toBeGreaterThan(20);
    // The dabs overlap, so the middle of the stroke was raised by more than one dab could, in one change from the seed's ground.
    const middle = Option.getOrThrow(
      Arr.findFirst(
        step,
        (change) =>
          change._tag === "point" &&
          change.i === HOME_X + 3 &&
          change.j === HOME_Z
      )
    );
    expect(middle.from).toBe(0);
    expect(middle.to).toBe(liftOf(land, HOME_X + 3, HOME_Z));
    expect(liftOf(land, HOME_X + 3, HOME_Z)).toBeGreaterThan(6);
    applyChanges(land, undoneOf(step));
    const after = heightsOf(land);
    expect(
      Arr.every(before, (height, at) => Math.abs(after[at] - height) < 1e-5)
    ).toBe(true);
    expect(liftOf(land, HOME_X + 3, HOME_Z)).toBe(0);
  });

  it("drops from a step what ended where it began", () => {
    const land = landOf(SEED);
    const raised = dabChanges(land, "raise", HOME_X, HOME_Z, 0);
    applyChanges(land, raised);
    const lowered = dabChanges(land, "lower", HOME_X, HOME_Z, 0);
    applyChanges(land, lowered);
    expect(raised.length).toBeGreaterThan(0);
    expect(joinedOf(raised, lowered)).toEqual([]);
    const bench = { at: 9, kind: "bench", turn: 0 } as const;
    const set = thingTo(land, 0, 0, 9, Option.some(bench));
    applyChanges(land, [set]);
    const turned = thingTo(land, 0, 0, 9, Option.some({ ...bench, turn: 1 }));
    applyChanges(land, [turned]);
    const taken = thingTo(land, 0, 0, 9, Option.none());
    expect(joinedOf([set], [turned])).toEqual([
      {
        _tag: "thing",
        at: 9,
        cx: 0,
        cz: 0,
        from: Option.none(),
        to: Option.some({ ...bench, turn: 1 }),
      },
    ]);
    expect(joinedOf([set, turned], [taken])).toEqual([]);
    // Turned and turned back within one step, the bench stands as it stood.
    const unturned = thingTo(land, 0, 0, 9, Option.some(bench));
    expect(joinedOf([turned], [unturned])).toEqual([]);
  });
});
