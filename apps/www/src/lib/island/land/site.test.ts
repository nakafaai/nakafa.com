// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { MAX_THINGS } from "@repo/backend/confect/island/chunk";
import type { Thing } from "@repo/backend/confect/island/things";
import { Array as Arr, Option, Result } from "effect";
import { applyChanges, thingTo } from "@/lib/island/land/changes";
import { CHUNK } from "@/lib/island/land/chunk";
import type { Land } from "@/lib/island/land/ground";
import {
  depthAt,
  heightAt,
  landOf,
  slopeAt,
  surfaceAt,
} from "@/lib/island/land/ground";
import { homeOf } from "@/lib/island/land/home";
import {
  footprintOf,
  placeAt,
  seatOf,
  siteOf,
  spotOf,
  thingNear,
  thingsAbout,
} from "@/lib/island/land/site";
import { thingSize } from "@/lib/island/models/things";

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

/** Whether a kind may stand at a place, or why not. */
function answerOf(land: Land, kind: Thing, x: number, z: number, turn: number) {
  return Result.match(siteOf(land, kind, x, z, turn, Option.none()), {
    onFailure: (reason) => reason,
    onSuccess: () => "fits" as const,
  });
}

/** Sets a thing down at a place without asking the land, as a world read from the server holds it. */
function stand(land: Land, kind: Thing, x: number, z: number, turn: number) {
  const spot = spotOf(x, z);
  applyChanges(land, [
    thingTo(
      land,
      spot.cx,
      spot.cz,
      spot.at,
      Option.some({ at: spot.at, kind, turn })
    ),
  ]);
  return spot;
}

/** The nearest place to home where a cottage fits with room for a bench beside it, turned either way. */
function yardOf(land: Land) {
  return placeWhere(
    (x, z) =>
      answerOf(land, "cottage", x, z, 0) === "fits" &&
      answerOf(land, "bench", x + 4.5, z, 0) === "fits" &&
      answerOf(land, "bench", x + 4, z, 1) === "fits"
  );
}

describe("island/land/site", () => {
  it("measures a thing's room from its model, and swaps its sides with a quarter turn", () => {
    const size = thingSize("bridge");
    expect(footprintOf("bridge", 0)).toEqual([size.width / 2, size.depth / 2]);
    expect(footprintOf("bridge", 1)).toEqual([size.depth / 2, size.width / 2]);
    expect(footprintOf("bridge", 2)).toEqual(footprintOf("bridge", 0));
    expect(footprintOf("bridge", 3)).toEqual(footprintOf("bridge", 1));
    expect(size.width).toBeGreaterThan(size.depth * 2);
  });

  it("names a place by its chunk and its place on the chunk's half-block grid, either side of zero", () => {
    expect(spotOf(0, 0)).toEqual({ at: 0, cx: 0, cz: 0 });
    expect(spotOf(0.5, 1)).toEqual({ at: 2 * CHUNK * 2 + 1, cx: 0, cz: 0 });
    expect(spotOf(-0.5, 31.8)).toEqual({ at: CHUNK * 2 - 1, cx: -1, cz: 1 });
    expect(placeAt(spotOf(-0.5, 31.8))).toEqual([-0.5, 32]);
    // A press a hand's width under zero falls on the origin's own spot, with nothing of a minus zero about it.
    expect(spotOf(-0.2, -0.1)).toEqual({ at: 0, cx: 0, cz: 0 });
    for (const [x, z] of [
      [12.3, -7.74],
      [-64, 63.5],
      [-0.7, -0.3],
      [1000.26, -1000.26],
    ] as const) {
      const spot = spotOf(x, z);
      expect(spot.at).toBeGreaterThanOrEqual(0);
      expect(spot.at).toBeLessThan(4 * CHUNK * CHUNK);
      expect(placeAt(spot)).toEqual([
        Math.round(x * 2) / 2,
        Math.round(z * 2) / 2,
      ]);
      expect(spotOf(...placeAt(spot))).toEqual(spot);
    }
  });

  it("sets a building on dry land and refuses it on water", () => {
    const land = landOf(SEED);
    const [x, z] = placeWhere(
      (i, j) => answerOf(land, "cottage", i, j, 0) === "fits"
    );
    expect(siteOf(land, "cottage", x, z, 0, Option.none())).toEqual(
      Result.succeed(spotOf(x, z))
    );
    expect(depthAt(land, x, z)).toBeLessThan(0);
    const [wetX, wetZ] = placeWhere((i, j) => depthAt(land, i, j) > 1);
    expect(answerOf(land, "cottage", wetX, wetZ, 0)).toBe("dry");
    expect(answerOf(land, "bench", wetX, wetZ, 0)).toBe("dry");
    // A corner in the water is enough: the cottage would stand with a foot wet.
    const [shoreX, shoreZ] = placeWhere(
      (i, j) =>
        depthAt(land, i, j) < -0.2 &&
        answerOf(land, "bench", i, j, 0) === "fits" &&
        answerOf(land, "cottage", i, j, 0) === "dry"
    );
    expect(heightAt(land, shoreX, shoreZ)).toBeGreaterThan(
      surfaceAt(land, shoreX, shoreZ)
    );
  });

  it("floats a boat and a lily on water and refuses them on land", () => {
    const land = landOf(SEED);
    const [x, z] = placeWhere(
      (i, j) => answerOf(land, "boat", i, j, 0) === "fits"
    );
    expect(depthAt(land, x, z)).toBeGreaterThan(0.12);
    expect(answerOf(land, "lily", x, z, 0)).toBe("fits");
    expect(seatOf(land, "boat", x, z, 0)).toBe(surfaceAt(land, x, z));
    expect(answerOf(land, "boat", HOME_X, HOME_Z, 0)).toBe("water");
    expect(answerOf(land, "lily", HOME_X, HOME_Z, 0)).toBe("water");
    // Water under its middle is not enough for a hull whose bow would lie on the bank.
    const [shoreX, shoreZ] = placeWhere(
      (i, j) =>
        answerOf(land, "lily", i, j, 0) === "fits" &&
        answerOf(land, "boat", i, j, 0) === "water"
    );
    expect(depthAt(land, shoreX, shoreZ)).toBeGreaterThan(0.12);
  });

  it("roots a coral on the bed under deep enough water, and a reed on a bank or in the shallows", () => {
    const land = landOf(SEED);
    const [deepX, deepZ] = placeWhere((i, j) => depthAt(land, i, j) > 0.7);
    expect(answerOf(land, "coral", deepX, deepZ, 0)).toBe("fits");
    expect(answerOf(land, "seagrass", deepX, deepZ, 1)).toBe("fits");
    expect(answerOf(land, "reed", deepX, deepZ, 0)).toBe("dry");
    expect(seatOf(land, "coral", deepX, deepZ, 0)).toBe(
      heightAt(land, deepX, deepZ)
    );
    const [shoalX, shoalZ] = placeWhere((i, j) => {
      const depth = depthAt(land, i, j);
      return depth > 0.05 && depth < 0.45;
    });
    expect(answerOf(land, "coral", shoalX, shoalZ, 0)).toBe("water");
    expect(answerOf(land, "brain", HOME_X, HOME_Z, 0)).toBe("water");
    expect(answerOf(land, "reed", shoalX, shoalZ, 0)).toBe("fits");
    expect(answerOf(land, "reed", HOME_X, HOME_Z, 0)).toBe("fits");
  });

  it("refuses ground too steep for a thing, and forgives a building more", () => {
    const land = landOf(SEED);
    const [x, z] = placeWhere(
      (i, j) => answerOf(land, "bench", i, j, 0) === "steep"
    );
    expect(slopeAt(land, x, z)).toBeGreaterThan(1);
    expect(depthAt(land, x, z)).toBeLessThan(0);
    const [cliffX, cliffZ] = placeWhere(
      (i, j) => answerOf(land, "cottage", i, j, 0) === "steep"
    );
    // The lattice points under and about the cottage's floor: what a bench bears is not enough to refuse it.
    const under = Arr.flatMap(Arr.range(-4, 4), (deep) =>
      Arr.map(Arr.range(-4, 4), (across) =>
        heightAt(land, cliffX + across, cliffZ + deep)
      )
    );
    expect(Math.max(...under) - Math.min(...under)).toBeGreaterThan(3);
    expect(answerOf(land, "bench", HOME_X, HOME_Z, 0)).toBe("fits");
    expect(answerOf(land, "cottage", HOME_X, HOME_Z, 0)).toBe("fits");
  });

  it("refuses a thing inside another's footprint, and stands neighbours shoulder to shoulder", () => {
    const land = landOf(SEED);
    const [x, z] = yardOf(land);
    const [halfWidth] = footprintOf("cottage", 0);
    const [benchWidth, benchDepth] = footprintOf("bench", 0);
    const own = stand(land, "cottage", x, z, 0);
    expect(answerOf(land, "bench", x, z, 0)).toBe("room");
    expect(answerOf(land, "bench", x + halfWidth, z + 1, 0)).toBe("room");
    expect(answerOf(land, "bridge", x + halfWidth, z, 0)).toBe("room");
    // Half a block of the bench's side inside the wall is too much; a hand's width is not.
    expect(halfWidth + benchWidth).toBeGreaterThan(4);
    expect(answerOf(land, "bench", x + 4, z, 0)).toBe("room");
    expect(answerOf(land, "bench", x + 4.5, z, 0)).toBe("fits");
    // Turned a quarter, the bench is slim enough to stand where it did not fit.
    expect(halfWidth + benchDepth).toBeLessThan(4);
    expect(answerOf(land, "bench", x + 4, z, 1)).toBe("fits");
    // A thing that is moved or turned does not stand in its own way.
    expect(siteOf(land, "cottage", x, z, 0, Option.some(own))).toEqual(
      Result.succeed(own)
    );
    expect(
      siteOf(land, "cottage", x, z, 0, Option.some({ ...own, at: own.at + 1 }))
    ).toEqual(Result.fail("room"));
    expect(
      siteOf(land, "cottage", x, z, 0, Option.some({ ...own, cx: own.cx + 1 }))
    ).toEqual(Result.fail("room"));
    expect(
      siteOf(land, "cottage", x, z, 0, Option.some({ ...own, cz: own.cz + 1 }))
    ).toEqual(Result.fail("room"));
  });

  it("refuses a thing inside the footprint of one that stands in the next chunk", () => {
    const land = landOf(SEED);
    const [x, z] = placeWhere(
      (i, j) =>
        ((j % CHUNK) + CHUNK) % CHUNK === 0 &&
        answerOf(land, "cottage", i, j, 0) === "fits"
    );
    const own = stand(land, "cottage", x, z, 0);
    const spot = spotOf(x, z - 2);
    expect(spot.cz).toBe(own.cz - 1);
    expect(answerOf(land, "lantern", x, z - 2, 0)).toBe("room");
  });

  it("refuses a small thing whose place on the grid another already holds", () => {
    const land = landOf(SEED);
    const [x, z] = yardOf(land);
    const own = stand(land, "lantern", x, z, 0);
    // A press a hand's width off the lantern falls on the lantern's own place of the half-block grid.
    expect(spotOf(x + 0.23, z)).toEqual(own);
    expect(answerOf(land, "lantern", x + 0.23, z, 0)).toBe("room");
    expect(answerOf(land, "lantern", x + 0.26, z, 0)).toBe("fits");
    expect(spotOf(x + 0.26, z)).not.toEqual(own);
  });

  it("refuses one thing more in a chunk that holds all it can", () => {
    const land = landOf(SEED);
    const [x, z] = yardOf(land);
    const [cx, cz] = [Math.floor(x / CHUNK), Math.floor(z / CHUNK)];
    // Lanterns on the odd places of every other block, which leaves the whole blocks between them free.
    const held = Arr.map(Arr.range(0, MAX_THINGS - 1), (slot) =>
      stand(
        land,
        "lantern",
        cx * CHUNK + 0.5 + (slot % 16) * 2,
        cz * CHUNK + 0.5 + Math.floor(slot / 16) * 2,
        0
      )
    );
    expect(thingsAbout(land, cx, cz)).toHaveLength(MAX_THINGS);
    expect(answerOf(land, "bench", x, z, 0)).toBe("full");
    // The chunk is counted before the ground is read: a lily on dry land is told the same.
    expect(answerOf(land, "lily", x, z, 0)).toBe("full");
    // A thing of the chunk's own that moves is not counted against it.
    expect(
      siteOf(land, "bench", x, z, 0, Option.some(held[MAX_THINGS - 1]))
    ).toEqual(Result.succeed(spotOf(x, z)));
    applyChanges(land, [
      thingTo(land, cx, cz, held[MAX_THINGS - 1].at, Option.none()),
    ]);
    expect(answerOf(land, "bench", x, z, 0)).toBe("fits");
  });

  it("lays a bridge over water and land alike, its deck on the higher bank and clear of the water", () => {
    const land = landOf(SEED);
    const [x, z] = placeWhere((i, j) => {
      const depth = depthAt(land, i, j);
      return depth > 0.05 && depth < 0.45;
    });
    expect(answerOf(land, "bridge", x, z, 0)).toBe("fits");
    expect(answerOf(land, "bridge", HOME_X, HOME_Z, 1)).toBe("fits");
    for (const turn of [0, 1, 2, 3]) {
      const [halfWidth, halfDepth] = footprintOf("bridge", turn);
      const ends =
        turn % 2 === 0
          ? [heightAt(land, x - halfWidth, z), heightAt(land, x + halfWidth, z)]
          : [
              heightAt(land, x, z - halfDepth),
              heightAt(land, x, z + halfDepth),
            ];
      const seat = seatOf(land, "bridge", x, z, turn);
      expect(seat).toBe(Math.max(...ends, surfaceAt(land, x, z) + 0.3));
      expect(seat).toBeGreaterThan(surfaceAt(land, x, z));
    }
    expect(seatOf(land, "bench", HOME_X, HOME_Z, 0)).toBe(
      heightAt(land, HOME_X, HOME_Z)
    );
  });

  it("finds the thing a place belongs to: the one whose footprint holds it, the nearest of two, none on open ground", () => {
    const land = landOf(SEED);
    const [x, z] = yardOf(land);
    const bench = stand(land, "bench", x, z, 0);
    const lantern = stand(land, "lantern", x + 1, z, 0);
    const far = stand(land, "cottage", x + 3 * CHUNK, z, 0);
    expect(thingNear(land, x + 0.2, z)).toEqual(Option.some(bench));
    expect(thingNear(land, x - 0.8, z + 0.3)).toEqual(Option.some(bench));
    expect(thingNear(land, x + 0.7, z)).toEqual(Option.some(lantern));
    expect(thingNear(land, x + 1.4, z - 0.4)).toEqual(Option.some(lantern));
    expect(thingNear(land, x, z + 0.8)).toEqual(Option.none());
    expect(thingNear(land, x - 3, z)).toEqual(Option.none());
    expect(thingNear(land, x + 3 * CHUNK + 2, z - 2)).toEqual(Option.some(far));
    // Only the chunks about a place are searched: the cottage three chunks off is not among them.
    expect(
      Arr.map(thingsAbout(land, bench.cx, bench.cz), (thing) => thing.kind)
    ).toEqual(["bench", "lantern"]);
    expect(thingsAbout(land, bench.cx + 2, bench.cz + 1)).toEqual([
      { ...far, kind: "cottage", turn: 0 },
    ]);
  });
});
