import { Array as Arr, Match, Predicate, Schema } from "effect";
import type { Object3D, Vector3 } from "three";

/** One place in a lab, in scene units. */
export const PointSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type Point = typeof PointSchema.Type;

/**
 * A pipe run: straight legs from corner to corner, each corner rounded into
 * an arc of radius `bend`, as a fitter bends rigid tube.
 */
const RouteSchema = Schema.Struct({
  bend: Schema.Finite,
  kind: Schema.Literal("route"),
  points: Schema.Array(PointSchema),
});

/**
 * A coil wound around the axis from `from` to `to`: its radius, how many
 * turns it makes (negative winds the other way), the angle it starts at, and
 * the leads that run into its first turn and out of its last.
 */
const HelixSchema = Schema.Struct({
  from: PointSchema,
  kind: Schema.Literal("helix"),
  lead: Schema.optionalKey(Schema.Array(PointSchema)),
  phase: Schema.optionalKey(Schema.Finite),
  radius: Schema.Finite,
  tail: Schema.optionalKey(Schema.Array(PointSchema)),
  to: PointSchema,
  turns: Schema.Finite,
});

/**
 * The line a part follows. A plain list of points is a smooth curve through
 * them; the other kinds name what the line is, and the engine works out its
 * shape. Every path has at least two points.
 */
export const PathSchema = Schema.Union([
  Schema.Array(PointSchema),
  RouteSchema,
  HelixSchema,
]);
export type Path = typeof PathSchema.Type;

/** The widest turn one piece of a sampled curve makes, in radians. */
const PIECE = Math.PI / 60;

/** The most pieces between two points of a curve. */
const PIECES = 24;

/** Points of a coil per turn, before the curve through them is sampled. */
const WINDS = 24;

/** The world axes a section may face, in the order ties fall. */
const AXES: readonly Point[] = [
  [1, 0, 0],
  [0, 0, 1],
  [0, 1, 0],
];

/** The sum of two vectors. */
export function add(a: Point, b: Point): Point {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** A vector scaled by a factor. */
export function scale(a: Point, factor: number): Point {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
}

/** The vector from `b` to `a`. */
export function sub(a: Point, b: Point): Point {
  return add(a, scale(b, -1));
}

/** The dot product of two vectors. */
export function dot(a: Point, b: Point) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** The cross product of two vectors. */
export function cross(a: Point, b: Point): Point {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** A vector's length. */
export function size(a: Point) {
  return Math.hypot(a[0], a[1], a[2]);
}

/** A vector at unit length; a vector with no length stays as it is. */
export function unit(a: Point): Point {
  return scale(a, 1 / Math.max(size(a), 1e-300));
}

/** The angle between two directions, in radians. */
export function angle(a: Point, b: Point) {
  return Math.acos(Math.min(1, Math.max(-1, dot(unit(a), unit(b)))));
}

/**
 * The unit direction square to `heading` that leans toward `toward` as far
 * as it can: where a section's own axis points.
 */
export function squareTo(heading: Point, toward: Point): Point {
  return unit(sub(toward, scale(heading, dot(toward, heading))));
}

/**
 * The unit direction square to `heading` toward the world axis it is least
 * aligned with, so the same line always gets the same section.
 */
export function sideOf(heading: Point): Point {
  const least = Arr.reduce(AXES, AXES[0], (best, axis) =>
    Math.abs(dot(axis, heading)) < Math.abs(dot(best, heading)) - 1e-9
      ? axis
      : best
  );
  return squareTo(heading, least);
}

/**
 * The arc that rounds the corner between two legs: `pieces + 1` places from
 * where it leaves the leg from `before`, `cut` short of the corner, to where
 * it joins the leg to `after`, each with the unit heading of the line there.
 * A corner that does not turn, or that doubles straight back, stays a point.
 */
export function arcThrough(
  before: Point,
  corner: Point,
  after: Point,
  cut: number,
  pieces: number
) {
  const into = unit(sub(corner, before));
  const out = unit(sub(after, corner));
  const turn = angle(into, out);
  const sine = Math.sin(turn);
  if (sine < 1e-6) {
    return [
      { heading: into, place: corner },
      { heading: out, place: corner },
    ];
  }
  const centre = add(
    corner,
    scale(unit(sub(out, into)), cut / Math.cos(turn / 2))
  );
  const first = sub(sub(corner, scale(into, cut)), centre);
  const last = sub(add(corner, scale(out, cut)), centre);
  return Arr.makeBy(pieces + 1, (step) => {
    const here = Math.sin((1 - step / pieces) * turn) / sine;
    const there = Math.sin((step / pieces) * turn) / sine;
    return {
      heading: unit(add(scale(into, here), scale(out, there))),
      place: add(centre, add(scale(first, here), scale(last, there))),
    };
  });
}

/** How far the turn between two legs cuts into each, for an arc of one radius. */
function cutFor(before: Point, corner: Point, after: Point, radius: number) {
  const turn = angle(sub(corner, before), sub(after, corner));
  return Math.min(
    radius * Math.tan(turn / 2),
    size(sub(corner, before)) / 2,
    size(sub(after, corner)) / 2
  );
}

/** A pipe run as points: its legs, and an arc at every corner. */
function routePoints(points: readonly Point[], bend: number) {
  const last = points.length - 1;
  const corners = Arr.flatMap(
    Arr.drop(Arr.dropRight(points, 1), 1),
    (corner, index) => {
      const before = points[index];
      const after = points[index + 2];
      const turn = angle(sub(corner, before), sub(after, corner));
      return Arr.map(
        arcThrough(
          before,
          corner,
          after,
          cutFor(before, corner, after, bend),
          Math.max(1, Math.ceil(turn / PIECE))
        ),
        (sample) => sample.place
      );
    }
  );
  return [points[0], ...corners, points[last]];
}

/**
 * One coordinate of a centripetal Catmull-Rom span from `x1` to `x2`, as the
 * coefficients of its cubic: the curve passes through every point and never
 * loops or overshoots between two of them.
 */
function spanCubic(
  [x0, x1, x2, x3]: readonly [number, number, number, number],
  [d0, d1, d2]: readonly [number, number, number]
) {
  const t1 = ((x1 - x0) / d0 - (x2 - x0) / (d0 + d1) + (x2 - x1) / d1) * d1;
  const t2 = ((x2 - x1) / d1 - (x3 - x1) / (d1 + d2) + (x3 - x2) / d2) * d1;
  return [x1, t1, -3 * x1 + 3 * x2 - 2 * t1 - t2, 2 * x1 - 2 * x2 + t1 + t2];
}

/** The knot spacing between two points of a centripetal curve. */
function knot(a: Point, b: Point) {
  return Math.max(Math.sqrt(size(sub(b, a))), 1e-4);
}

/** A point as far past `end` as `inner` lies before it: what a curve runs on toward when nothing follows. */
function past(end: Point, inner: Point) {
  return sub(scale(end, 2), inner);
}

/**
 * A smooth curve through `points`, finer where it turns more. It leaves its
 * first point as if it came from `before` and reaches its last as if it ran
 * on to `after`.
 */
function splinePoints(points: readonly Point[], before: Point, after: Point) {
  const control = Arr.dedupeAdjacentWith(
    points,
    (a, b) => size(sub(a, b)) < 1e-12
  );
  const last = control.length - 1;
  const spans = Arr.flatMap(Arr.dropRight(control, 1), (p1, index) => {
    const p2 = control[index + 1];
    const p0 = index === 0 ? before : control[index - 1];
    const p3 = index === last - 1 ? after : control[index + 2];
    const knots = [knot(p0, p1), knot(p1, p2), knot(p2, p3)] as const;
    const cubics = Arr.makeBy(3, (axis) =>
      spanCubic([p0[axis], p1[axis], p2[axis], p3[axis]], knots)
    );
    const turn =
      angle(sub(p1, p0), sub(p2, p1)) + angle(sub(p2, p1), sub(p3, p2));
    const pieces = Math.min(PIECES, Math.max(1, Math.ceil(turn / PIECE)));
    return Arr.makeBy(pieces, (step): Point => {
      const t = step / pieces;
      const at = ([c0, c1, c2, c3]: readonly number[]) =>
        c0 + t * (c1 + t * (c2 + t * c3));
      return [at(cubics[0]), at(cubics[1]), at(cubics[2])];
    });
  });
  return [...spans, control[last]];
}

/** A smooth curve through points that runs straight on past both of its ends. */
function curvePoints(points: readonly Point[]) {
  const last = points.length - 1;
  return splinePoints(
    points,
    past(points[0], points[1]),
    past(points[last], points[last - 1])
  );
}

/**
 * A coil as points: its leads, then the curve through its turns. A coil
 * without a lead leaves its first turn already winding, so its ends keep
 * its radius.
 */
function helixPoints(helix: typeof HelixSchema.Type) {
  const axis = sub(helix.to, helix.from);
  const out = sideOf(unit(axis));
  const round = cross(out, unit(axis));
  const count = Math.max(2, Math.ceil(Math.abs(helix.turns) * WINDS));
  const wind = (step: number) => {
    const share = step / count;
    const around = (helix.phase ?? 0) + share * helix.turns * 2 * Math.PI;
    return add(
      add(helix.from, scale(axis, share)),
      add(
        scale(out, Math.cos(around) * helix.radius),
        scale(round, Math.sin(around) * helix.radius)
      )
    );
  };
  const lead = helix.lead ?? [];
  const tail = helix.tail ?? [];
  const points = [...lead, ...Arr.makeBy(count + 1, wind), ...tail];
  const last = points.length - 1;
  return splinePoints(
    points,
    lead.length > 0 ? past(points[0], points[1]) : wind(-1),
    tail.length > 0 ? past(points[last], points[last - 1]) : wind(count + 1)
  );
}

/** A path's own points, before it is measured. */
function pointsOf(path: Path) {
  if (!Predicate.hasProperty(path, "kind")) {
    return curvePoints(path);
  }
  return Match.value(path).pipe(
    Match.discriminatorsExhaustive("kind")({
      helix: helixPoints,
      route: (route) => routePoints(route.points, route.bend),
    })
  );
}

/**
 * A path walked out and measured: its places as runs of three numbers, and
 * how far along the path each one lies. A part is swept along it, and a
 * bead, a pulse or a drop rides it with `placeOn`.
 */
export function trackOf(path: Path) {
  const points = Arr.dedupeAdjacentWith(
    pointsOf(path),
    (a, b) => size(sub(a, b)) < 1e-12
  );
  const places = new Float64Array(points.length * 3);
  const lengths = new Float64Array(points.length);
  Arr.forEach(points, (point, index) => {
    places.set(point, index * 3);
    lengths[index] =
      index === 0
        ? 0
        : lengths[index - 1] + size(sub(point, points[index - 1]));
  });
  return { lengths, places };
}

/** A walked path. */
export type Track = ReturnType<typeof trackOf>;

/** A track's whole length, in scene units. */
export function lengthOf(track: Track) {
  const last = track.lengths.length - 1;
  return track.lengths[last];
}

/** The leg of a track that holds the place `distance` along it. */
export function legAt(track: Track, distance: number) {
  let low = 0;
  let high = track.lengths.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (track.lengths[middle] <= distance) {
      low = middle;
    } else {
      high = middle;
    }
  }
  const span = track.lengths[high] - track.lengths[low];
  return { from: low, share: (distance - track.lengths[low]) / span };
}

/**
 * The place a share of the way along a track, from 0 at its start to 1 at
 * its end: where a part on the path starts out.
 */
export function pointOn(track: Track, share: number): Point {
  const { from, share: within } = legAt(
    track,
    Math.min(1, Math.max(0, share)) * lengthOf(track)
  );
  const a = from * 3;
  const { places } = track;
  return [
    places[a] + (places[a + 3] - places[a]) * within,
    places[a + 1] + (places[a + 4] - places[a + 1]) * within,
    places[a + 2] + (places[a + 5] - places[a + 2]) * within,
  ];
}

/**
 * Moves `target` to the place a share of the way along a track, from 0 at
 * its start to 1 at its end, without allocating: a pulse in a pipe or a bead
 * on a wire calls it every frame.
 *
 * @param track - The walked path
 * @param share - How far along, from 0 to 1
 * @param target - The position to move, such as an object's own
 */
export function placeOn(
  track: Track,
  share: number,
  target: Pick<Vector3, "set">
) {
  const { from, share: within } = legAt(
    track,
    Math.min(1, Math.max(0, share)) * lengthOf(track)
  );
  const a = from * 3;
  const { places } = track;
  target.set(
    places[a] + (places[a + 3] - places[a]) * within,
    places[a + 1] + (places[a + 4] - places[a + 1]) * within,
    places[a + 2] + (places[a + 5] - places[a + 2]) * within
  );
}

/**
 * Moves a row of riders along a track, each its own share ahead of `phase`
 * and round again past the end: pulses in a pipe, beads on a loop, drops
 * down a tube. It allocates nothing, so a lab calls it every frame.
 *
 * @param track - The walked path
 * @param riders - The objects to move, such as a group's children
 * @param shares - How far ahead of the phase each rider runs, from 0 to 1
 * @param phase - How far the row has travelled, in laps
 */
export function rideOn(
  track: Track,
  riders: readonly Pick<Object3D, "position">[],
  shares: readonly number[],
  phase: number
) {
  const count = Math.min(riders.length, shares.length);
  for (let index = 0; index < count; index += 1) {
    placeOn(track, (phase + shares[index]) % 1, riders[index].position);
  }
}
