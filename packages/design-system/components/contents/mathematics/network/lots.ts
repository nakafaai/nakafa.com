import { seededUniforms } from "@repo/design-system/components/contents/mathematics/chance";
import type {
  Road,
  Town,
} from "@repo/design-system/components/contents/mathematics/network/graph";
import { linksOf } from "@repo/design-system/components/contents/mathematics/network/graph";
import type { Spot } from "@repo/design-system/components/contents/mathematics/network/layout";
import { placeOf } from "@repo/design-system/components/contents/mathematics/network/layout";
import { Array as Arr, Schema } from "effect";

/**
 * One house of a model town: where it stands from the town's middle, its
 * size in metres, how far it is turned, and which of two paints its walls
 * and its roof take.
 */
const LotSchema = Schema.Struct({
  depth: Schema.Finite,
  height: Schema.Finite,
  roof: Schema.Literals([0, 1]),
  turn: Schema.Finite,
  wall: Schema.Literals([0, 1]),
  width: Schema.Finite,
  x: Schema.Finite,
  z: Schema.Finite,
});
export type Lot = typeof LotSchema.Type;

/** How many places round a town's middle a house may take. */
const PLACES = 12;

/** How far a house keeps from the line of a road, in radians round the town. */
const CLEAR = 0.42;

/** How far the houses stand from a town's middle, in metres. */
const RING = 0.038;

/** The angle between two bearings, from 0 to pi. */
export function angleBetween(a: number, b: number) {
  const turn = 2 * Math.PI;
  return Math.abs(((((a - b) % turn) + turn * 1.5) % turn) - Math.PI);
}

/** The bearings of the roads leaving a town at `here` toward each of `ends`, as the board's x and z give them. */
export function bearingsOf(here: Spot, ends: readonly Spot[]) {
  return Arr.map(ends, (end) => Math.atan2(end.z - here.z, end.x - here.x));
}

/**
 * The houses of the town that stands `index` in the town list: three to five
 * low houses round a small square in the middle, each on a place clear of the
 * roads that leave it, so no road runs through a house. The same town always
 * gets the same houses.
 */
export function townLots(index: number, bearings: readonly number[]) {
  const values = seededUniforms(7919 * (index + 1), 32);
  const at = (slot: number) => Arr.getUnsafe(values, slot);
  const count = 3 + Math.min(2, Math.floor(at(0) * 3));
  const offset = (at(1) * 2 * Math.PI) / PLACES;
  const free = Arr.filter(
    Arr.makeBy(PLACES, (place) => offset + (2 * Math.PI * place) / PLACES),
    (angle) => Arr.every(bearings, (road) => angleBetween(angle, road) >= CLEAR)
  );
  const built = Math.min(count, free.length);
  // Effect's makeBy always makes at least one, so a town with no room builds none here.
  const chosen =
    built === 0
      ? []
      : Arr.makeBy(built, (house) =>
          Arr.getUnsafe(free, Math.floor((house * free.length) / built))
        );
  return Arr.map(chosen, (angle, house): Lot => {
    const base = 2 + house * 5;
    const ring = RING + at(base) * 0.008;
    return {
      depth: 0.016 + at(base + 1) * 0.004,
      height: 0.012 + at(base + 2) * 0.005,
      roof: at(base + 3) < 0.5 ? 0 : 1,
      turn: -angle + Math.PI / 2 + (at(base + 4) - 0.5) * 0.3,
      wall: at(base + 4) < 0.6 ? 0 : 1,
      width: 0.021 + at(base + 2) * 0.005,
      x: ring * Math.cos(angle),
      z: ring * Math.sin(angle),
    };
  });
}

/**
 * The houses of every town on the board, where `spots` holds the towns'
 * places in the order of the town list: each town's houses keep clear of the
 * roads that leave it.
 */
export function boardLots(
  towns: readonly Town[],
  roads: readonly Road[],
  spots: readonly Spot[]
) {
  const at = placeOf(towns, spots);
  return Arr.map(towns, (town, index) => {
    const ends = Arr.map(linksOf(towns, roads, town.id), (link) =>
      at(link.town)
    );
    return townLots(index, bearingsOf(Arr.getUnsafe(spots, index), ends));
  });
}
