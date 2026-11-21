import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Order, Schema } from "effect";

/**
 * One seed resting in the pile: the middle of its body in metres, `x` and
 * `z` across the tube and `y` up it, the turn of its long axis about the
 * tube's axis, and the roll of the seed about its own long axis.
 */
const SeedSchema = Schema.Struct({
  roll: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
  yaw: Schema.Finite,
  z: Schema.Finite,
});
export type Seed = typeof SeedSchema.Type;

/**
 * A pile to settle: `count` seeds, each a capsule `length` long and `width`
 * across, dropped one after another onto a flat floor at height `floor`
 * inside a tube of inner radius `radius`, no higher than `ceiling`. `salt`
 * scatters one tube's pile differently from another's.
 */
const PileSchema = Schema.Struct({
  ceiling: Schema.Finite,
  count: Schema.Int,
  floor: Schema.Finite,
  length: Schema.Finite,
  radius: Schema.Finite,
  salt: Schema.Finite,
  width: Schema.Finite,
});
export type Pile = typeof PileSchema.Type;

/** A point across the tube, in metres. */
type Flat = readonly [number, number];

/** The distance from `point` to the segment from `start` to `end`. */
function toSegment(point: Flat, start: Flat, end: Flat) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const along = Math.min(
    1,
    Math.max(
      0,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) /
        (dx * dx + dz * dz)
    )
  );
  return Math.hypot(
    point[0] - start[0] - along * dx,
    point[1] - start[1] - along * dz
  );
}

/** Which side of the line through `start` and `end` the point lies on. */
function side(start: Flat, end: Flat, point: Flat) {
  return Math.sign(
    (end[0] - start[0]) * (point[1] - start[1]) -
      (end[1] - start[1]) * (point[0] - start[0])
  );
}

/**
 * The shortest distance between two segments across the tube: zero where
 * they cross, else the nearest an end of one comes to the other.
 */
export function segmentGap(
  first: readonly [Flat, Flat],
  second: readonly [Flat, Flat]
) {
  const [a, b] = first;
  const [c, d] = second;
  const crosses =
    side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
  if (crosses) {
    return 0;
  }
  return Math.min(
    toSegment(a, c, d),
    toSegment(b, c, d),
    toSegment(c, a, b),
    toSegment(d, a, b)
  );
}

/** The two ends of the axis of a seed's capsule, `reach` either side of its middle. */
export function seedAxis(seed: Seed, reach: number): readonly [Flat, Flat] {
  const dx = Math.cos(seed.yaw) * reach;
  const dz = Math.sin(seed.yaw) * reach;
  return [
    [seed.x - dx, seed.z - dz],
    [seed.x + dx, seed.z + dz],
  ];
}

/** How many spots each seed is tried at before it settles into the lowest. */
const TRIES = 24;

/**
 * Settles a pile of seeds as they come to rest when tipped into a tube, one
 * after another: each lies on its side and, of a few scattered spots and
 * turns, rolls into the lowest, where it rests on the floor or on the seeds
 * already under it. Seeds lie flat, so two capsules at heights `y1` and `y2`
 * whose axes come within `d` across the tube touch exactly when
 * (y2 − y1)² + d² equals the width squared; a seed is lifted just that far
 * above every seed it would otherwise cut into. A spot that would poke
 * through the wall is never tried, and a seed with no spot under the ceiling
 * is left out. No two seeds of the pile overlap.
 */
export function settlePile(pile: Pile) {
  const half = pile.width / 2;
  const reach = pile.length / 2 - half;
  const room = pile.radius - half;
  const byHeight = Order.mapInput(Order.Number, (seed: Seed) => seed.y);
  return Arr.reduce(
    Arr.range(0, pile.count - 1),
    Arr.empty<Seed>(),
    (seeds, index) => {
      const spots = Arr.flatMap(Arr.range(0, TRIES - 1), (trial) => {
        const draw = index * TRIES + trial;
        const spread = room * Math.sqrt(hashUnit(draw, pile.salt));
        const bearing = hashUnit(draw + 101, pile.salt) * Math.PI * 2;
        const candidate = {
          roll: hashUnit(draw + 307, pile.salt) * Math.PI * 2,
          x: Math.cos(bearing) * spread,
          y: pile.floor + half,
          yaw: hashUnit(draw + 211, pile.salt) * Math.PI,
          z: Math.sin(bearing) * spread,
        };
        const axis = seedAxis(candidate, reach);
        if (!Arr.every(axis, ([x, z]) => Math.hypot(x, z) <= room)) {
          return [];
        }
        const rest = Arr.reduce(seeds, candidate.y, (height, below) => {
          const gap = segmentGap(axis, seedAxis(below, reach));
          return gap < pile.width
            ? Math.max(height, below.y + Math.sqrt(pile.width ** 2 - gap ** 2))
            : height;
        });
        return rest + half > pile.ceiling ? [] : [{ ...candidate, y: rest }];
      });
      return Arr.isArrayNonEmpty(spots)
        ? Arr.append(seeds, Arr.min(spots, byHeight))
        : seeds;
    }
  );
}
