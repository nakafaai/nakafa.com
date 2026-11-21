import { seededUniforms } from "@repo/design-system/components/contents/mathematics/chance";
import type {
  Road,
  Town,
} from "@repo/design-system/components/contents/mathematics/network/graph";
import { roadBetween } from "@repo/design-system/components/contents/mathematics/network/graph";
import { Array as Arr, HashMap, Option, Order, Schema } from "effect";

/** A place on the model board: across and back from its middle, in metres. */
const SpotSchema = Schema.Struct({ x: Schema.Finite, z: Schema.Finite });
export type Spot = typeof SpotSchema.Type;

/** The middle of the board. */
const ORIGIN: Spot = { x: 0, z: 0 };

/**
 * Looks up where a town stands by its id, where `spots` holds the places in
 * the order of the town list. A town not in the list stands at the middle.
 */
export function placeOf(towns: readonly Town[], spots: readonly Spot[]) {
  const places = HashMap.fromIterable(
    Arr.map(towns, (town, index): readonly [string, Spot] => [
      town.id,
      Arr.getUnsafe(spots, index),
    ])
  );
  return (id: string) =>
    Option.getOrElse(HashMap.get(places, id), () => ORIGIN);
}

/** How many rounds the layout moves every town toward its ideal distances. */
const ROUNDS = 240;

/** How many rounds push apart two towns that stand too close. */
const SPREAD_ROUNDS = 60;

/** How many starting circles the layout tries, keeping the best. */
const STARTS = 16;

/**
 * The road distance between every two towns in kilometres, by Floyd and
 * Warshall's method: the length of the shortest route between them.
 */
export function roadDistances(towns: readonly Town[], roads: readonly Road[]) {
  const size = towns.length;
  const table = Arr.map(towns, (from) =>
    Arr.map(towns, (to) =>
      from.id === to.id
        ? 0
        : Option.match(roadBetween(roads, from.id, to.id), {
            onNone: () => Number.POSITIVE_INFINITY,
            onSome: (road) => road.length,
          })
    )
  );
  for (let via = 0; via < size; via += 1) {
    for (let from = 0; from < size; from += 1) {
      for (let to = 0; to < size; to += 1) {
        const through = table[from][via] + table[via][to];
        if (through < table[from][to]) {
          table[from][to] = through;
        }
      }
    }
  }
  return table;
}

/**
 * The towns on a circle, where one try of the layout starts: the first try
 * in list order, each later one in an order shuffled by its own seed.
 */
function circleStart(count: number, radius: number, attempt: number): Spot[] {
  const keys = seededUniforms(104_729 * attempt + 1, count);
  const order = Arr.sort(
    Arr.makeBy(count, (index) => index),
    Order.mapInput(Order.Number, (index: number) =>
      attempt === 0 ? index : Arr.getUnsafe(keys, index)
    )
  );
  const seat = Arr.makeBy(count, () => 0);
  Arr.forEach(order, (town, place) => {
    seat[town] = place;
  });
  return Arr.map(seat, (place) => {
    const angle = (2 * Math.PI * place) / count;
    return { x: radius * Math.cos(angle), z: radius * Math.sin(angle) };
  });
}

/** Whether two segments cross at a point inside both. */
function segmentsCross(a: Spot, b: Spot, c: Spot, d: Spot) {
  const side = (p: Spot, q: Spot, r: Spot) =>
    (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/** How many pairs of roads with no town in common cross on the board. */
export function crossingsOf(
  towns: readonly Town[],
  roads: readonly Road[],
  spots: readonly Spot[]
) {
  const at = placeOf(towns, spots);
  const ends = (road: Road) => [at(road.from), at(road.to)] as const;
  return Arr.reduce(roads, 0, (sum, one, index) =>
    Arr.reduce(Arr.drop(roads, index + 1), sum, (count, two) => {
      const shared =
        Arr.dedupe([one.from, one.to, two.from, two.to]).length < 4;
      return !shared && segmentsCross(...ends(one), ...ends(two))
        ? count + 1
        : count;
    })
  );
}

/** How far the spots are from keeping every road distance, weighted as `settle` weighs them. */
function stressOf(
  spots: readonly Spot[],
  ideal: readonly (readonly number[])[]
) {
  return Arr.reduce(spots, 0, (sum, one, a) =>
    Arr.reduce(spots, sum, (total, two, b) => {
      const target = ideal[a][b];
      if (b <= a || !Number.isFinite(target)) {
        return total;
      }
      const apart = Math.hypot(two.x - one.x, two.z - one.z);
      return total + ((apart - target) / target) ** 2;
    })
  );
}

/** One try of the layout: where the towns settled, how many roads cross, and its stress. */
const TrySchema = Schema.Struct({
  crossings: Schema.Int,
  spots: Schema.Array(SpotSchema),
  stress: Schema.Finite,
});
type Try = typeof TrySchema.Type;

/**
 * One round of stress majorization: each town in turn moves to the place
 * that best keeps every other town at its road distance, each pair weighted
 * by the inverse square of that distance, so near neighbours count most.
 */
function settle(spots: Spot[], ideal: readonly (readonly number[])[]) {
  Arr.forEach(spots, (_, at) => {
    let x = 0;
    let z = 0;
    let weights = 0;
    Arr.forEach(spots, (other, to) => {
      const target = ideal[at][to];
      if (to === at || !Number.isFinite(target)) {
        return;
      }
      const here = spots[at];
      const gap = Math.max(
        Math.hypot(here.x - other.x, here.z - other.z),
        1e-9
      );
      const weight = 1 / (target * target);
      x += weight * (other.x + (target * (here.x - other.x)) / gap);
      z += weight * (other.z + (target * (here.z - other.z)) / gap);
      weights += weight;
    });
    if (weights > 0) {
      spots[at] = { x: x / weights, z: z / weights };
    }
  });
}

/** Turns the spots about their middle so their longest spread runs across the board. */
function alongWidth(spots: readonly Spot[]): Spot[] {
  const count = spots.length;
  const mx = Arr.reduce(spots, 0, (sum, spot) => sum + spot.x) / count;
  const mz = Arr.reduce(spots, 0, (sum, spot) => sum + spot.z) / count;
  const sxx = Arr.reduce(spots, 0, (sum, s) => sum + (s.x - mx) ** 2);
  const szz = Arr.reduce(spots, 0, (sum, s) => sum + (s.z - mz) ** 2);
  const sxz = Arr.reduce(spots, 0, (sum, s) => sum + (s.x - mx) * (s.z - mz));
  const angle = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  return Arr.map(spots, (spot) => {
    const x = spot.x - mx;
    const z = spot.z - mz;
    return { x: x * cos - z * sin, z: x * sin + z * cos };
  });
}

/** How much more one axis may be stretched than the other to fill the board. */
const STRETCH = 2.5;

/**
 * Scales and centres the spots to fill `width` by `depth`. Each axis is
 * stretched on its own, so a long, narrow network still uses the board's
 * depth, but never more than `STRETCH` times the other, so a network laid
 * out nearly in a line is not blown up across the board.
 */
function fitInside(spots: readonly Spot[], width: number, depth: number) {
  const xs = Arr.map(spots, (spot) => spot.x);
  const zs = Arr.map(spots, (spot) => spot.z);
  const [left, right] = [Math.min(...xs), Math.max(...xs)];
  const [back, front] = [Math.min(...zs), Math.max(...zs)];
  const across = width / Math.max(right - left, 1e-9);
  const along = depth / Math.max(front - back, 1e-9);
  const even = Math.min(across, along);
  return Arr.map(spots, (spot) => ({
    x: (spot.x - (left + right) / 2) * Math.min(across, even * STRETCH),
    z: (spot.z - (back + front) / 2) * Math.min(along, even * STRETCH),
  }));
}

/** Pushes apart every two towns closer than `gap`, keeping each inside the board. */
function spread(spots: Spot[], gap: number, width: number, depth: number) {
  const clampX = (x: number) => Math.min(width / 2, Math.max(-width / 2, x));
  const clampZ = (z: number) => Math.min(depth / 2, Math.max(-depth / 2, z));
  for (let round = 0; round < SPREAD_ROUNDS; round += 1) {
    Arr.forEach(spots, (_, a) => {
      Arr.forEach(spots, (__, b) => {
        if (b <= a) {
          return;
        }
        const one = spots[a];
        const two = spots[b];
        // A hair across keeps two towns on one spot apart along the width.
        const dx = two.x - one.x + 1e-12;
        const dz = two.z - one.z;
        const apart = Math.hypot(dx, dz);
        if (apart >= gap) {
          return;
        }
        const push = (gap - apart) / 2;
        const ux = dx / apart;
        const uz = dz / apart;
        spots[a] = {
          x: clampX(one.x - ux * push),
          z: clampZ(one.z - uz * push),
        };
        spots[b] = {
          x: clampX(two.x + ux * push),
          z: clampZ(two.z + uz * push),
        };
      });
    });
  }
  return spots;
}

/**
 * Where each town stands on a board `width` by `depth` metres, in the order
 * of the town list. Towns joined by a short road stand close and those far
 * apart by road stand far apart, as on a map, though no road's drawn length
 * is its true length: the plates give that. The same network always lays
 * out the same way, and no two towns stand closer than `gap`.
 */
export function layoutTowns(
  towns: readonly Town[],
  roads: readonly Road[],
  { depth, gap, width }: { depth: number; gap: number; width: number }
): readonly Spot[] {
  const ideal = roadDistances(towns, roads);
  const finite = Arr.filter(Arr.flatten(ideal), Number.isFinite);
  const radius = Math.max(...finite, 1) / 2;
  const tries = Arr.makeBy(STARTS, (attempt): Try => {
    const spots = circleStart(towns.length, radius, attempt);
    for (let round = 0; round < ROUNDS; round += 1) {
      settle(spots, ideal);
    }
    return {
      crossings: crossingsOf(towns, roads, spots),
      spots,
      stress: stressOf(spots, ideal),
    };
  });
  const best = Arr.headNonEmpty(
    Arr.sort(
      tries,
      Order.combine(
        Order.mapInput(Order.Number, (each: Try) => each.crossings),
        Order.mapInput(Order.Number, (each: Try) => each.stress)
      )
    )
  );
  return spread(
    fitInside(alongWidth(best.spots), width, depth),
    gap,
    width,
    depth
  );
}

/** How far a point lies from the segment between `a` and `b`. */
export function segmentDistance(point: Spot, a: Spot, b: Spot) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const share = Math.min(
    1,
    Math.max(
      0,
      ((point.x - a.x) * dx + (point.z - a.z) * dz) /
        Math.max(dx * dx + dz * dz, 1e-18)
    )
  );
  return Math.hypot(point.x - (a.x + dx * share), point.z - (a.z + dz * share));
}

/** The places along a road a plate may take, as shares of the road from its first town. */
const PLATE_SHARES = [0.5, 0.36, 0.64] as const;

/** How far back from a town its name stands on the board, as the sign's label rises over it. */
const NAME_BACK = 0.04;

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
 * one side, at its middle or a little toward either end. Of those six places
 * it takes the one that keeps farthest from every town, every town's name,
 * every other road and the plates already placed, so a plate's label stays
 * clear of the rest wherever the board leaves room. Labels are wide, so the
 * distance between two of them counts what lies across less.
 */
export function plateSpots(
  towns: readonly Town[],
  roads: readonly Road[],
  spots: readonly Spot[],
  offset: number
): readonly Spot[] {
  const at = placeOf(towns, spots);
  const endsOf = (road: Road) => [at(road.from), at(road.to)] as const;
  const names = Arr.map(spots, (spot) => ({
    x: spot.x,
    z: spot.z - NAME_BACK,
  }));
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
    const candidates = Arr.flatMap(PLATE_SHARES, (share) =>
      Arr.map([1, -1] as const, (side) => ({
        x: from.x + (to.x - from.x) * share + across.x * side,
        z: from.z + (to.z - from.z) * share + across.z * side,
      }))
    );
    const best = Arr.reduce(
      candidates,
      { clear: Number.NEGATIVE_INFINITY, spot: ORIGIN },
      (found, spot) => {
        const clear = clearance(spot);
        return clear > found.clear ? { clear, spot } : found;
      }
    );
    return [...placed, best.spot];
  });
}
