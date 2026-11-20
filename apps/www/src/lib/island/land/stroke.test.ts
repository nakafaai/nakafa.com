// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import { applyChanges, pointTo } from "@/lib/island/land/changes";
import { CHUNK, LIFT_STEPS, PAINT } from "@/lib/island/land/chunk";
import { LIFT_LIMIT, liftOf, paintOf } from "@/lib/island/land/edits";
import { floraOf } from "@/lib/island/land/flora";
import type { Land } from "@/lib/island/land/ground";
import { coverAt, depthAt, heightAt, landOf } from "@/lib/island/land/ground";
import { homeOf } from "@/lib/island/land/home";
import { dabChanges, levelChanges, reachOf } from "@/lib/island/land/stroke";

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

/** The lattice points within `reach` blocks of a lattice point. */
function pointsAbout(x: number, z: number, reach: number) {
  const span = Math.ceil(reach);
  return Arr.filter(
    Arr.flatMap(Arr.range(-span, span), (dz) =>
      Arr.map(Arr.range(-span, span), (dx) => [x + dx, z + dz] as const)
    ),
    ([i, j]) => Math.hypot(i - x, j - z) <= reach
  );
}

/** How many of the lattice points within `reach` blocks of a place stand under water. */
function wetAbout(land: Land, x: number, z: number, reach: number) {
  return Arr.filter(
    pointsAbout(x, z, reach),
    ([i, j]) => depthAt(land, i, j) > 0
  ).length;
}

/** The nearest place to the seed's home that a test asks for. */
function placeWhere(test: (x: number, z: number) => boolean) {
  return Option.getOrThrow(Arr.findFirst(AROUND, ([x, z]) => test(x, z)));
}

/** The nearest place to home with dry ground for five blocks all around it. */
function dryPlace(land: Land) {
  return placeWhere((x, z) =>
    Arr.every(pointsAbout(x, z, 5), ([i, j]) => depthAt(land, i, j) < -0.3)
  );
}

describe("island/land/stroke", () => {
  it("reaches narrow with a path, a little wider to clear, and broad with the rest", () => {
    expect(reachOf("path")).toBeLessThan(reachOf("clear"));
    expect(reachOf("clear")).toBeLessThan(reachOf("raise"));
    expect(reachOf("pond")).toBe(reachOf("raise"));
    expect(reachOf("grass")).toBe(reachOf("level"));
  });

  it("lifts the middle of a raising dab more than its rim, and nothing past its reach", () => {
    const land = landOf(SEED);
    const before = heightAt(land, HOME_X, HOME_Z);
    const raised = dabChanges(land, "raise", HOME_X, HOME_Z, 0);
    applyChanges(land, raised);
    const middle = liftOf(land, HOME_X, HOME_Z);
    expect(middle).toBeGreaterThan(liftOf(land, HOME_X + 1, HOME_Z + 1));
    expect(liftOf(land, HOME_X + 1, HOME_Z + 1)).toBeGreaterThan(
      liftOf(land, HOME_X + 2, HOME_Z)
    );
    expect(liftOf(land, HOME_X + 2, HOME_Z)).toBe(0);
    expect(liftOf(land, HOME_X - 1, HOME_Z)).toBe(
      liftOf(land, HOME_X, HOME_Z + 1)
    );
    expect(heightAt(land, HOME_X, HOME_Z)).toBeCloseTo(
      before + middle / LIFT_STEPS,
      5
    );
    for (const change of raised) {
      expect(change._tag).toBe("point");
      expect(change.to).toBeGreaterThan(0);
    }
    expect(
      Arr.every(pointsAbout(HOME_X, HOME_Z, 6), ([i, j]) =>
        Math.hypot(i - HOME_X, j - HOME_Z) <= reachOf("raise")
          ? liftOf(land, i, j) >= 0
          : liftOf(land, i, j) === 0
      )
    ).toBe(true);
  });

  it("lowers the ground by as much as a raising dab lifts it", () => {
    const land = landOf(SEED);
    const raised = dabChanges(land, "raise", HOME_X + 0.5, HOME_Z + 0.5, 0);
    const lowered = dabChanges(land, "lower", HOME_X + 0.5, HOME_Z + 0.5, 0);
    expect(lowered).toHaveLength(raised.length);
    applyChanges(land, lowered);
    // A dab between four lattice points falls on each alike.
    expect(liftOf(land, HOME_X, HOME_Z)).toBeLessThan(0);
    expect(liftOf(land, HOME_X + 1, HOME_Z + 1)).toBe(
      liftOf(land, HOME_X, HOME_Z)
    );
    applyChanges(
      land,
      dabChanges(land, "raise", HOME_X + 0.5, HOME_Z + 0.5, 0)
    );
    expect(
      Arr.every(
        pointsAbout(HOME_X, HOME_Z, 4),
        ([i, j]) => liftOf(land, i, j) === 0
      )
    ).toBe(true);
  });

  it("stops raising and lowering a point that stands as far from the seed's ground as a world stores", () => {
    const land = landOf(SEED);
    applyChanges(land, [
      ...Option.toArray(pointTo(land, "lift", HOME_X, HOME_Z, LIFT_LIMIT)),
      ...Option.toArray(
        pointTo(land, "lift", HOME_X + 1, HOME_Z, LIFT_LIMIT - 1)
      ),
    ]);
    const raised = dabChanges(land, "raise", HOME_X, HOME_Z, 0);
    expect(
      Arr.some(
        raised,
        (change) =>
          change._tag === "point" && change.i === HOME_X && change.j === HOME_Z
      )
    ).toBe(false);
    applyChanges(land, raised);
    expect(liftOf(land, HOME_X, HOME_Z)).toBe(LIFT_LIMIT);
    expect(liftOf(land, HOME_X + 1, HOME_Z)).toBe(LIFT_LIMIT);
    applyChanges(land, [
      ...Option.toArray(pointTo(land, "lift", HOME_X, HOME_Z, 1 - LIFT_LIMIT)),
    ]);
    applyChanges(land, dabChanges(land, "lower", HOME_X, HOME_Z, 0));
    expect(liftOf(land, HOME_X, HOME_Z)).toBe(-LIFT_LIMIT);
  });

  it("ends a levelling stroke flat at the height it began on, over hills and hollows alike", () => {
    const land = landOf(SEED);
    const [x, z] = dryPlace(land);
    for (const [along, brush] of [
      [0, "raise"],
      [2, "raise"],
      [4, "lower"],
      [6, "raise"],
    ] as const) {
      for (const dab of Arr.range(0, 5)) {
        applyChanges(
          land,
          dabChanges(land, brush, x + along, z + (dab % 2), 0)
        );
      }
    }
    const level = heightAt(land, x, z);
    const under = Arr.flatMap(Arr.range(0, 6), (along) =>
      Arr.map([-1, 0, 1], (aside) => [x + along, z + aside] as const)
    );
    const offOf = () =>
      Arr.map(under, ([i, j]) => Math.abs(heightAt(land, i, j) - level));
    expect(Math.max(...offOf())).toBeGreaterThan(2);
    // The stroke passes over the ground until a pass changes nothing.
    const passes = Arr.findFirst(Arr.range(1, 60), () => {
      const changed = Arr.map(Arr.range(0, 12), (dab) => {
        const changes = dabChanges(land, "level", x + dab * 0.5, z, level);
        applyChanges(land, changes);
        return changes.length;
      });
      return Arr.every(changed, (count) => count === 0);
    });
    expect(Option.isSome(passes)).toBe(true);
    expect(Math.max(...offOf())).toBeLessThan(1 / LIFT_STEPS);
  });

  it("digs a pond that holds water, and grows the ground back when the pond is painted over", () => {
    const land = landOf(SEED);
    const [x, z] = dryPlace(land);
    const points = pointsAbout(x, z, reachOf("pond"));
    const before = Arr.map(points, ([i, j]) => heightAt(land, i, j));
    const dug = dabChanges(land, "pond", x, z, 0);
    expect(dug).toHaveLength(points.length);
    applyChanges(land, dug);
    expect(depthAt(land, x, z)).toBeGreaterThan(0.5);
    expect(wetAbout(land, x, z, reachOf("pond"))).toBe(points.length);
    expect(dabChanges(land, "pond", x, z, 0)).toEqual([]);
    const filled = dabChanges(land, "grass", x, z, 0);
    expect(filled).toHaveLength(points.length);
    applyChanges(land, filled);
    expect(wetAbout(land, x, z, reachOf("pond"))).toBe(0);
    expect(
      Arr.every(
        points,
        ([i, j], at) => Math.abs(heightAt(land, i, j) - before[at]) < 1e-5
      )
    ).toBe(true);
    expect(coverAt(land, x, z)).toBe("grass");
  });

  it("paints the dry ground of a shore and never the water beside it", () => {
    const land = landOf(SEED);
    const reach = reachOf("sand");
    const [x, z] = placeWhere((i, j) => {
      const wet = wetAbout(land, i, j, reach);
      return wet > 3 && pointsAbout(i, j, reach).length - wet > 3;
    });
    const dry = Arr.filter(
      pointsAbout(x, z, reach),
      ([i, j]) => depthAt(land, i, j) <= 0
    );
    const painted = dabChanges(land, "sand", x, z, 0);
    applyChanges(land, painted);
    expect(painted).toHaveLength(dry.length);
    for (const [i, j] of pointsAbout(x, z, reach)) {
      expect(paintOf(land, i, j)).toBe(
        Arr.some(dry, ([di, dj]) => di === i && dj === j)
          ? PAINT.sand
          : PAINT.none
      );
    }
    // Painted once, a second dab of the same surface changes nothing, and another surface takes its place.
    expect(dabChanges(land, "sand", x, z, 0)).toEqual([]);
    expect(dabChanges(land, "meadow", x, z, 0)).toHaveLength(dry.length);
  });

  it("digs no pond and lays no path in open water", () => {
    const land = landOf(SEED);
    const [x, z] = placeWhere(
      (i, j) => wetAbout(land, i, j, 3) === pointsAbout(i, j, 3).length
    );
    expect(dabChanges(land, "pond", x, z, 0)).toEqual([]);
    expect(dabChanges(land, "path", x, z, 0)).toEqual([]);
  });

  it("clears the wild plants rooted under the brush, and no other", () => {
    const land = landOf(SEED);
    const [cx, cz] = [Math.floor(HOME_X / CHUNK), Math.floor(HOME_Z / CHUNK)];
    const grown = floraOf(land, cx, cz);
    const [plant] = grown;
    const under = Arr.filter(
      grown,
      (other) =>
        Math.hypot(other.x - plant.x, other.z - plant.z) <= reachOf("clear")
    );
    const cleared = dabChanges(land, "clear", plant.x, plant.z, 0);
    expect(cleared).toHaveLength(under.length);
    expect(cleared).toContainEqual({
      _tag: "point",
      from: 0,
      i: plant.i,
      j: plant.j,
      layer: "clear",
      to: 1,
    });
    applyChanges(land, cleared);
    expect(floraOf(land, cx, cz)).toHaveLength(grown.length - under.length);
    expect(dabChanges(land, "clear", plant.x, plant.z, 0)).toEqual([]);
  });

  it("levels the ground under a rectangle to its mean height, and eases the rim around it halfway", () => {
    const land = landOf(SEED);
    const [x, z] = dryPlace(land);
    const inside = Arr.flatMap(Arr.range(0, 3), (dz) =>
      Arr.map(Arr.range(0, 4), (dx) => [x + dx, z + dz] as const)
    );
    const mean =
      Arr.reduce(inside, 0, (sum, [i, j]) => sum + heightAt(land, i, j)) /
      inside.length;
    const rim = heightAt(land, x - 1, z + 1);
    const far = heightAt(land, x - 2, z + 1);
    applyChanges(land, levelChanges(land, [x, z], [x + 4, z + 3]));
    for (const [i, j] of inside) {
      expect(Math.abs(heightAt(land, i, j) - mean)).toBeLessThanOrEqual(
        0.5 / LIFT_STEPS + 1e-5
      );
    }
    expect(heightAt(land, x - 1, z + 1)).toBeCloseTo(
      rim + Math.round(((mean - rim) / 2) * LIFT_STEPS) / LIFT_STEPS,
      5
    );
    expect(heightAt(land, x - 2, z + 1)).toBe(far);
    // Level ground is left as it is.
    expect(levelChanges(land, [x + 1, z + 1], [x + 3, z + 2])).toEqual([]);
  });

  it("eases the ground about a rectangle too small to hold a lattice point halfway to the height at its middle", () => {
    const land = landOf(SEED);
    applyChanges(land, dabChanges(land, "raise", HOME_X, HOME_Z, 0));
    applyChanges(land, dabChanges(land, "raise", HOME_X, HOME_Z, 0));
    const middle = heightAt(land, HOME_X + 0.5, HOME_Z + 0.5);
    const around = pointsAbout(HOME_X, HOME_Z, 3);
    const before = Arr.map(around, ([i, j]) => heightAt(land, i, j));
    applyChanges(
      land,
      levelChanges(
        land,
        [HOME_X + 0.2, HOME_Z + 0.2],
        [HOME_X + 0.8, HOME_Z + 0.8]
      )
    );
    Arr.forEach(around, ([i, j], at) => {
      const near =
        i >= HOME_X - 1 &&
        i <= HOME_X + 2 &&
        j >= HOME_Z - 1 &&
        j <= HOME_Z + 2;
      expect(heightAt(land, i, j)).toBeCloseTo(
        near
          ? before[at] +
              Math.round(((middle - before[at]) / 2) * LIFT_STEPS) / LIFT_STEPS
          : before[at],
        5
      );
    });
  });
});
