import { sidesFor } from "@repo/design-system/components/three/form/detail";
import { stitch } from "@repo/design-system/components/three/form/mesh";
import type {
  Point,
  Track,
} from "@repo/design-system/components/three/form/path";
import {
  add,
  angle,
  cross,
  dot,
  legAt,
  lengthOf,
  PathSchema,
  PointSchema,
  scale,
  sideOf,
  squareTo,
  sub,
  trackOf,
  unit,
} from "@repo/design-system/components/three/form/path";
import { Array as Arr, Match, Order, Predicate, Schema } from "effect";

/**
 * How a swept part ends: `flat` closes it with a disc, `round` with a dome,
 * and `open` leaves it a hollow tube.
 */
const EndSchema = Schema.Literals(["flat", "round", "open"]);

/**
 * A part made by carrying a section along a path: a wire, a lead, a hose, a
 * pipe, a vessel, a coil or a strip.
 */
export const SweepSchema = Schema.Struct({
  /** How it ends: one word for both ends, or its start and its end. Flat when not named. */
  ends: Schema.optionalKey(
    Schema.Union([EndSchema, Schema.Tuple([EndSchema, EndSchema])])
  ),
  /**
   * A flattened section, for a strip or a ribbon: how thick it is as a share
   * of its width, and the direction its broad face looks toward.
   */
  flat: Schema.optionalKey(Schema.Tuple([Schema.Finite, PointSchema])),
  /** The line it follows. */
  path: PathSchema,
  /**
   * The section's radius, in scene units: one number, or stops of how far
   * along (0 to 1) and the radius there, eased from one to the next, for a
   * taper or a bulge.
   */
  radius: Schema.Union([
    Schema.Finite,
    Schema.Array(Schema.Tuple([Schema.Finite, Schema.Finite])),
  ]),
});
export type Sweep = typeof SweepSchema.Type;

/** The widest swing of the path between two sections, in radians. */
const SWING = Math.PI / 12;

/** Sections along each stretch between two stops of a varying radius. */
const EASES = 12;

/** Eases from 0 to 1 as `t` crosses from 0 to 1. */
function ease(t: number) {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/** The place of a track's point. */
function placeAt(track: Track, index: number): Point {
  return [
    track.places[index * 3],
    track.places[index * 3 + 1],
    track.places[index * 3 + 2],
  ];
}

/** The unit heading of a track at one of its points. */
function headingAt(track: Track, index: number) {
  const last = track.lengths.length - 1;
  return unit(
    sub(
      placeAt(track, Math.min(last, index + 1)),
      placeAt(track, Math.max(0, index - 1))
    )
  );
}

/** Both ends of a sweep, as its start and its end. */
function endsOf(sweep: Sweep) {
  const ends = sweep.ends ?? "flat";
  return Predicate.isString(ends) ? ([ends, ends] as const) : ends;
}

/**
 * The radius of a sweep at each distance along a path of one length: its
 * stops eased from one to the next.
 */
function radiusOf(sweep: Sweep, length: number) {
  const stops = Predicate.isNumber(sweep.radius)
    ? [[0, sweep.radius] as const]
    : sweep.radius;
  return (distance: number) =>
    Arr.reduce(
      Arr.zip(stops, Arr.drop(stops, 1)),
      stops[0][1],
      (radius, [from, to]) =>
        radius +
        (to[1] - from[1]) *
          ease((distance / length - from[0]) / (to[0] - from[0]))
    );
}

/** The distances at which a track swings enough, or strays enough from its chord, to need a section. */
function bendStations(track: Track, grain: number) {
  const count = track.lengths.length;
  const keep = new Uint8Array(count);
  let swung = 0;
  let from = 0;
  for (let index = 1; index < count - 1; index += 1) {
    swung += angle(
      sub(placeAt(track, index), placeAt(track, index - 1)),
      sub(placeAt(track, index + 1), placeAt(track, index))
    );
    const run = track.lengths[index] - track.lengths[from];
    if (swung >= SWING || (run * swung) / 8 >= grain) {
      keep[index] = 1;
      swung = 0;
      from = index;
    }
  }
  return Arr.filter(Arr.fromIterable(track.lengths), (_, index) =>
    Boolean(keep[index])
  );
}

/** The distances a varying radius needs sections at: even ones between its stops. */
function radiusStations(sweep: Sweep, length: number) {
  const even = Predicate.isNumber(sweep.radius)
    ? 0
    : (sweep.radius.length - 1) * EASES;
  return even > 0 ? Arr.makeBy(even + 1, (step) => (step / even) * length) : [];
}

/** Where a track is and where it heads, a distance along it. */
function stationAt(track: Track, distance: number) {
  const { from, share } = legAt(track, distance);
  const blend = (a: Point, b: Point) =>
    add(scale(a, 1 - share), scale(b, share));
  return {
    heading: unit(blend(headingAt(track, from), headingAt(track, from + 1))),
    place: blend(placeAt(track, from), placeAt(track, from + 1)),
  };
}

/**
 * Carries a section's own axis from one station to the next without letting
 * it twist: the double reflection of a rotation-minimizing frame.
 */
function carry(
  side: Point,
  from: ReturnType<typeof stationAt>,
  to: ReturnType<typeof stationAt>
) {
  const step = sub(to.place, from.place);
  const mirror = (vector: Point, across: Point) =>
    sub(
      vector,
      scale(
        across,
        (2 * dot(across, vector)) /
          Math.max(dot(across, across), Number.MIN_VALUE)
      )
    );
  const turn = sub(to.heading, mirror(from.heading, step));
  return unit(squareTo(to.heading, mirror(mirror(side, step), turn)));
}

/** One section of a sweep: where it stands, how it is turned, how wide it is, and the way its surface faces. */
function ringAt(
  station: ReturnType<typeof stationAt>,
  side: Point,
  radius: number,
  slope: number,
  travel: number
) {
  return { ...station, along: -slope, out: 1, radius, side, travel };
}

/**
 * The rings that close one end of a sweep, from its rim outward: a disc for
 * a flat end, the rings of a dome for a round one, and none for an end left
 * open. `way` is 1 past the sweep's end and -1 before its start.
 */
function capRings(
  kind: typeof EndSchema.Type,
  rim: ReturnType<typeof ringAt>,
  way: number,
  sides: number
) {
  return Match.value(kind).pipe(
    Match.when("flat", () => [
      { ...rim, along: way, out: 0 },
      {
        ...rim,
        along: way,
        out: 0,
        radius: 0,
        travel: rim.travel + way * rim.radius,
      },
    ]),
    Match.when("round", () =>
      Arr.makeBy(sides / 4, (step) => {
        const lean = ((step + 1) / (sides / 4)) * (Math.PI / 2);
        const sine = Math.sin(lean);
        const cosine = Math.sqrt(1 - sine * sine);
        return {
          ...rim,
          along: way * sine,
          out: cosine,
          place: add(rim.place, scale(rim.heading, way * rim.radius * sine)),
          radius: rim.radius * cosine,
          travel: rim.travel + way * rim.radius * lean,
        };
      })
    ),
    Match.when("open", () => []),
    Match.exhaustive
  );
}

/**
 * The surface of a swept part: its vertices, their normals, their texture
 * coordinates in scene units (along the path, then around the section) and
 * its triangles. The section is carried along the path on frames that never
 * flip or twist, its sides and its sections are as many as the grain asks
 * for, and its ends are closed, domed or left open.
 *
 * @param sweep - What the part is
 * @param grain - The farthest a facet may stand off the true surface, from `grainOf`
 */
export function sweepShape(sweep: Sweep, grain: number) {
  const track = trackOf(sweep.path);
  const length = lengthOf(track);
  const radius = radiusOf(sweep, length);
  const stations = Arr.map(
    Arr.dedupeAdjacentWith(
      Arr.sort(
        [
          0,
          ...bendStations(track, grain),
          ...radiusStations(sweep, length),
          length,
        ],
        Order.Number
      ),
      (a, b) => Math.abs(b - a) < length * 1e-9
    ),
    (distance) => ({ ...stationAt(track, distance), distance })
  );
  const [share, face] = sweep.flat ?? [1, undefined];
  const first = stations[0];
  const sides = sidesFor(
    grain,
    Arr.reduce(stations, 0, (widest, station) =>
      Math.max(widest, radius(station.distance))
    )
  );

  const sidesOf = Arr.scan(
    Arr.zip(stations, Arr.drop(stations, 1)),
    face === undefined
      ? sideOf(first.heading)
      : cross(squareTo(first.heading, face), first.heading),
    (side, [from, to]) => carry(side, from, to)
  );
  const reach = length * 1e-4;
  const body = Arr.map(stations, (station, index) => {
    const before = Math.max(0, station.distance - reach);
    const after = Math.min(length, station.distance + reach);
    return ringAt(
      station,
      sidesOf[index],
      radius(station.distance),
      (radius(after) - radius(before)) / (after - before),
      station.distance
    );
  });
  const [start, end] = endsOf(sweep);
  const rings = [
    ...Arr.reverse(capRings(start, body[0], -1, sides)),
    ...body,
    ...capRings(end, body[stations.length - 1], 1, sides),
  ];

  const columns = sides + 1;
  const positions = new Float32Array(rings.length * columns * 3);
  const normals = new Float32Array(rings.length * columns * 3);
  const uvs = new Float32Array(rings.length * columns * 2);
  Arr.forEach(rings, (ring, row) => {
    const lift = cross(ring.heading, ring.side);
    for (let column = 0; column < columns; column += 1) {
      const around = (column / sides) * 2 * Math.PI;
      const across = scale(ring.side, Math.cos(around));
      const up = scale(lift, Math.sin(around));
      const vertex = row * columns + column;
      positions.set(
        add(ring.place, scale(add(across, scale(up, share)), ring.radius)),
        vertex * 3
      );
      normals.set(
        unit(
          add(
            scale(unit(add(across, scale(up, 1 / share))), ring.out),
            scale(ring.heading, ring.along)
          )
        ),
        vertex * 3
      );
      uvs.set([ring.travel, around * ring.radius], vertex * 2);
    }
  });

  return {
    indices: stitch(
      sides,
      Arr.map(rings, (ring) => ring.radius),
      Arr.filter(
        Arr.makeBy(rings.length - 1, (row) => row),
        (row) =>
          rings[row].place === rings[row + 1].place &&
          rings[row].radius === rings[row + 1].radius
      )
    ),
    normals,
    positions,
    uvs,
  };
}

/** A built surface: what a geometry is made from. */
export type Shape = ReturnType<typeof sweepShape>;
