import { MAX_THINGS } from "@repo/backend/confect/island/chunk";
import type { Thing } from "@repo/backend/confect/island/things";
import { THINGS } from "@repo/backend/confect/island/things";
import { Array as Arr, MutableHashMap, Option, Order, Result } from "effect";
import { CHUNK, keyOf } from "@/lib/island/land/chunk";
import type { Land } from "@/lib/island/land/ground";
import { depthAt, heightAt, surfaceAt } from "@/lib/island/land/ground";
import { thingSize } from "@/lib/island/models/things";

/** The places across a chunk's half-block grid. */
const GRID = CHUNK * 2;

/** How much two footprints may overlap before one refuses the other, in blocks, so neighbours stand shoulder to shoulder. */
const SQUEEZE = 0.2;

/** Where each kind stands (ADR 0050, W2): afloat, on the bed under water, at the water's shallow edge, or over anything as a bridge does. Every other kind stands on dry land. */
const STANDS: Partial<Record<Thing, "any" | "bank" | "bed" | "water">> = {
  boat: "water",
  brain: "bed",
  bridge: "any",
  coral: "bed",
  lily: "water",
  reed: "bank",
  seagrass: "bed",
};

/** How much the ground may rise under a thing before it is too steep for it, in blocks: a building forgives more, since the land is levelled under it. */
const STEEP = { building: 3, other: 2.4 } as const;

/** Each kind's room on the land, measured from its model once. */
const sizes = MutableHashMap.empty<Thing, ReturnType<typeof thingSize>>();

/** Half the width and half the depth a thing takes when set down with a turn, in blocks. */
export function footprintOf(kind: Thing, turn: number) {
  const size = Option.getOrElse(MutableHashMap.get(sizes, kind), () => {
    const measured = thingSize(kind);
    MutableHashMap.set(sizes, kind, measured);
    return measured;
  });
  return turn % 2 === 0
    ? ([size.width / 2, size.depth / 2] as const)
    : ([size.depth / 2, size.width / 2] as const);
}

/** The spot a place falls on: its chunk and its place on the chunk's half-block grid. */
export function spotOf(x: number, z: number) {
  // A place just under zero rounds to minus zero, which a store keeps apart from zero, so it is made zero here.
  const column = Math.round(x * 2) || 0;
  const row = Math.round(z * 2) || 0;
  const cx = Math.floor(column / GRID);
  const cz = Math.floor(row / GRID);
  return { at: (row - cz * GRID) * GRID + (column - cx * GRID), cx, cz };
}

/** Where a spot lies in the world. */
export function placeAt(spot: {
  readonly at: number;
  readonly cx: number;
  readonly cz: number;
}) {
  return [
    spot.cx * CHUNK + (spot.at % GRID) / 2,
    spot.cz * CHUNK + Math.floor(spot.at / GRID) / 2,
  ] as const;
}

/** Every thing set down in the chunks about a chunk, each with its spot. */
export function thingsAbout(land: Land, cx: number, cz: number) {
  return Arr.flatMap(Arr.range(0, 8), (slot) => {
    const [nx, nz] = [cx + (slot % 3) - 1, cz + Math.floor(slot / 3) - 1];
    return Arr.map(
      Option.getOrElse(
        MutableHashMap.get(land.things, keyOf(nx, nz)),
        () => []
      ),
      (thing) => ({ ...thing, cx: nx, cz: nz })
    );
  });
}

/** Where a kind stands. */
function standOf(kind: Thing) {
  return STANDS[kind] ?? "land";
}

/** The height a thing's foot rests at: the water's face for what floats, the higher bank for a bridge, the ground for the rest. */
export function seatOf(
  land: Land,
  kind: Thing,
  x: number,
  z: number,
  turn: number
) {
  const stand = standOf(kind);
  if (stand === "water") {
    return surfaceAt(land, x, z);
  }
  if (stand !== "any") {
    return heightAt(land, x, z);
  }
  const [halfWidth, halfDepth] = footprintOf(kind, turn);
  const along =
    turn % 2 === 0 ? ([halfWidth, 0] as const) : ([0, halfDepth] as const);
  return Math.max(
    heightAt(land, x - along[0], z - along[1]),
    heightAt(land, x + along[0], z + along[1]),
    surfaceAt(land, x, z) + 0.3
  );
}

/**
 * Whether a thing may stand at a place with a turn (ADR 0050, W2), and why
 * not. The place is read where the thing would land, on the half-block grid,
 * so a press beside a small thing cannot land on it. It is refused for: no
 * room beside what already stands there (`ignore` names a spot that
 * does not count, the thing's own while it is moved), water where it needs
 * land or land where it needs water, ground too steep, or a chunk that holds
 * all the things it can.
 */
export function siteOf(
  land: Land,
  kind: Thing,
  x: number,
  z: number,
  turn: number,
  ignore: Option.Option<ReturnType<typeof spotOf>>
) {
  const spot = spotOf(x, z);
  const [sx, sz] = placeAt(spot);
  const [halfWidth, halfDepth] = footprintOf(kind, turn);
  const others = Arr.filter(
    thingsAbout(land, spot.cx, spot.cz),
    (other) =>
      !Option.exists(
        ignore,
        (own) =>
          own.at === other.at && own.cx === other.cx && own.cz === other.cz
      )
  );
  const crowded = Arr.some(others, (other) => {
    const [ox, oz] = placeAt(other);
    const [otherWidth, otherDepth] = footprintOf(other.kind, other.turn);
    return (
      Math.abs(ox - sx) < halfWidth + otherWidth - SQUEEZE &&
      Math.abs(oz - sz) < halfDepth + otherDepth - SQUEEZE
    );
  });
  if (crowded) {
    return Result.fail("room" as const);
  }
  const held = Arr.filter(
    others,
    (other) => other.cx === spot.cx && other.cz === spot.cz
  );
  if (held.length >= MAX_THINGS) {
    return Result.fail("full" as const);
  }
  const stand = standOf(kind);
  if (stand === "any") {
    return Result.succeed(spot);
  }
  const corners = Arr.map(
    [
      [0, 0],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const,
    ([across, deep]) =>
      [
        sx + across * Math.max(0, halfWidth - SQUEEZE),
        sz + deep * Math.max(0, halfDepth - SQUEEZE),
      ] as const
  );
  if (stand === "water") {
    return Arr.every(corners, ([px, pz]) => depthAt(land, px, pz) > 0.12)
      ? Result.succeed(spot)
      : Result.fail("water" as const);
  }
  if (stand === "bed") {
    return depthAt(land, sx, sz) > 0.5
      ? Result.succeed(spot)
      : Result.fail("water" as const);
  }
  if (stand === "bank") {
    return depthAt(land, sx, sz) < 0.6
      ? Result.succeed(spot)
      : Result.fail("dry" as const);
  }
  // `Arr.some` would tell the compiler the corners are none once it answered no, so the wet corner is looked for instead.
  const wet = Arr.findFirst(
    corners,
    ([px, pz]) => depthAt(land, px, pz) > 0.03
  );
  if (Option.isSome(wet)) {
    return Result.fail("dry" as const);
  }
  const heights = Arr.map(corners, ([px, pz]) => heightAt(land, px, pz));
  const rise = Math.max(...heights) - Math.min(...heights);
  return rise >
    (THINGS[kind].shelf === "building" ? STEEP.building : STEEP.other)
    ? Result.fail("steep" as const)
    : Result.succeed(spot);
}

/** The thing a place on the land belongs to: the one whose footprint holds it, the nearest when several do, none on open ground. */
export function thingNear(land: Land, x: number, z: number) {
  const spot = spotOf(x, z);
  const near = Arr.filterMap(thingsAbout(land, spot.cx, spot.cz), (thing) => {
    const [tx, tz] = placeAt(thing);
    const [halfWidth, halfDepth] = footprintOf(thing.kind, thing.turn);
    return Math.abs(tx - x) <= Math.max(0.5, halfWidth) &&
      Math.abs(tz - z) <= Math.max(0.5, halfDepth)
      ? Result.succeed({
          away: Math.hypot(tx - x, tz - z),
          spot: { at: thing.at, cx: thing.cx, cz: thing.cz },
        })
      : Result.fail(thing);
  });
  return Option.map(
    Arr.head(
      Arr.sort(
        near,
        Order.mapInput(
          Order.Number,
          (found: (typeof near)[number]) => found.away
        )
      )
    ),
    (found) => found.spot
  );
}
