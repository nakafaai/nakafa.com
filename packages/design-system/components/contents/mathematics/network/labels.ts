import type {
  Road,
  Town,
} from "@repo/design-system/components/contents/mathematics/network/graph";
import type { Spot } from "@repo/design-system/components/contents/mathematics/network/layout";
import {
  placeOf,
  segmentDistance,
} from "@repo/design-system/components/contents/mathematics/network/layout";
import { Array as Arr, Schema } from "effect";

/**
 * Where the map's labels stand so none covers another: each town's name on
 * the side of its pin that its roads leave free, and each road's length plate
 * beside its road, clear of the towns, their names, the other roads and the
 * plates already placed.
 */

/**
 * Which way a town's name stands from its pin: to the left, over the middle
 * or to the right, and behind the pin or in front of it.
 */
const SideSchema = Schema.Struct({
  x: Schema.Literals([-1, 0, 1]),
  z: Schema.Literals([-1, 1]),
});
export type Side = typeof SideSchema.Type;

/** The sides a name may take, the one behind the pin and over its middle first, which a tie keeps. */
const SIDES: readonly [Side, ...Side[]] = [
  { x: 0, z: -1 },
  { x: 1, z: -1 },
  { x: -1, z: -1 },
  { x: 0, z: 1 },
  { x: 1, z: 1 },
  { x: -1, z: 1 },
];

/** How far from its pin the middle of a name stands on the board: across, and behind or in front. */
const NAME_AWAY = { across: 0.055, back: 0.048 } as const;

/** How far a name reaches to either side of its middle, in metres on the board. */
const NAME_HALF = 0.034;

/** The middle of a town's name on the board, for a pin at `spot` and a name on `side`. */
function nameSpot(spot: Spot, side: Side): Spot {
  return {
    x: spot.x + side.x * NAME_AWAY.across,
    z: spot.z + side.z * NAME_AWAY.back,
  };
}

/** The middle and both ends of a name whose middle stands at `spot`. */
function nameReach(spot: Spot): readonly Spot[] {
  return [
    spot,
    { x: spot.x - NAME_HALF, z: spot.z },
    { x: spot.x + NAME_HALF, z: spot.z },
  ];
}

/**
 * The side each town's name stands on, in the order of the town list: of the
 * six sides, the one whose name keeps farthest from every road, every other
 * pin and the names already placed, so no name lies across a road or another
 * name wherever the board leaves room.
 */
export function nameSides(
  towns: readonly Town[],
  roads: readonly Road[],
  spots: readonly Spot[]
): readonly Side[] {
  const at = placeOf(towns, spots);
  const segments = Arr.map(
    roads,
    (road) => [at(road.from), at(road.to)] as const
  );
  return Arr.reduce(spots, Arr.empty<Side>(), (placed, spot, index) => {
    const taken = Arr.map(placed, (side, other) =>
      nameSpot(Arr.getUnsafe(spots, other), side)
    );
    const pins = Arr.filter(spots, (_, other) => other !== index);
    const clearance = (side: Side) =>
      Math.min(
        Number.POSITIVE_INFINITY,
        ...Arr.flatMap(nameReach(nameSpot(spot, side)), (point) => [
          ...Arr.map(segments, ([from, to]) =>
            segmentDistance(point, from, to)
          ),
          ...Arr.map(pins, (pin) =>
            Math.hypot(pin.x - point.x, pin.z - point.z)
          ),
          ...Arr.flatMap(taken, (name) =>
            Arr.map(nameReach(name), (other) =>
              Math.hypot(other.x - point.x, (other.z - point.z) * 2)
            )
          ),
        ])
      );
    const best = Arr.reduce(
      SIDES,
      { clear: Number.NEGATIVE_INFINITY, side: Arr.headNonEmpty(SIDES) },
      (found, side) => {
        const clear = clearance(side);
        return clear > found.clear ? { clear, side } : found;
      }
    );
    return [...placed, best.side];
  });
}

/** The places along a road a plate may take, as shares of the road from its first town. */
const PLATE_SHARES = [0.5, 0.36, 0.64, 0.24, 0.76] as const;

/** How far out a plate may lie from its road, as multiples of its offset. */
const PLATE_REACH = [1, 1.7] as const;

/**
 * How much wider than tall a label reads on the board: two labels side by
 * side clash at a distance this many times greater than two one above the
 * other, so clearance between labels counts distance across at this share.
 */
const LABEL_WIDE = 2.5;

/** How far apart two labels read, counting distance across at `LABEL_WIDE`'s share. */
function labelGap(one: Spot, two: Spot) {
  return Math.hypot((two.x - one.x) / LABEL_WIDE, two.z - one.z);
}

/**
 * Where each road's length plate lies: beside the road, `offset` metres to
 * one side or a little farther out, at its middle or toward either end. Of
 * those places it takes the one that keeps farthest from every town, every
 * town's name, every other road and the plates already placed, so a plate's
 * label stays clear of the rest wherever the board leaves room. Labels are
 * wide, so the distance between two of them counts what lies across less.
 */
export function plateSpots(
  towns: readonly Town[],
  roads: readonly Road[],
  spots: readonly Spot[],
  offset: number
): readonly Spot[] {
  const at = placeOf(towns, spots);
  const endsOf = (road: Road) => [at(road.from), at(road.to)] as const;
  const sides = nameSides(towns, roads, spots);
  const names = Arr.flatMap(spots, (spot, index) =>
    nameReach(nameSpot(spot, Arr.getUnsafe(sides, index)))
  );
  return Arr.reduce(roads, Arr.empty<Spot>(), (placed, road, index) => {
    const [from, to] = endsOf(road);
    const length = Math.max(Math.hypot(to.x - from.x, to.z - from.z), 1e-9);
    const across = {
      x: (-(to.z - from.z) / length) * offset,
      z: ((to.x - from.x) / length) * offset,
    };
    const others = Arr.filter(roads, (_, other) => other !== index);
    const clearance = (spot: Spot) =>
      Math.min(
        ...Arr.map(spots, (town) =>
          Math.hypot(town.x - spot.x, town.z - spot.z)
        ),
        ...Arr.map([...names, ...placed], (label) => labelGap(label, spot)),
        ...Arr.map(others, (other) => segmentDistance(spot, ...endsOf(other)))
      );
    const candidates = Arr.flatMap(PLATE_REACH, (reach) =>
      Arr.flatMap(PLATE_SHARES, (share) =>
        Arr.map([1, -1] as const, (side) => ({
          x: from.x + (to.x - from.x) * share + across.x * side * reach,
          z: from.z + (to.z - from.z) * share + across.z * side * reach,
        }))
      )
    );
    const best = Arr.reduce(
      candidates,
      { clear: Number.NEGATIVE_INFINITY, spot: Arr.headNonEmpty(candidates) },
      (found, spot) => {
        const clear = clearance(spot);
        return clear > found.clear ? { clear, spot } : found;
      }
    );
    return [...placed, best.spot];
  });
}
