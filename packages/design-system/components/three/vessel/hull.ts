import { Array as Arr, Schema } from "effect";
import { BufferGeometry, Float32BufferAttribute } from "three";

/**
 * The lines of a ship's hull, in scene units: its length overall, its beam,
 * its depth from keel to deck amidships, how much its deck rises toward the
 * bow (the sheer, as a share of the depth), where along the hull the bow
 * starts to fine in and the stern to run out (shares of the length from each
 * end), how wide the transom is (a share of the beam), how far the stem
 * leans forward (a share of the depth), how far the forefoot rises at the
 * stem, and how square the midship section is (2 is round, larger is boxier
 * with a tighter bilge).
 */
const HullLinesSchema = Schema.Struct({
  beam: Schema.Finite,
  bow: Schema.Finite,
  depth: Schema.Finite,
  forefoot: Schema.Finite,
  length: Schema.Finite,
  rake: Schema.Finite,
  run: Schema.Finite,
  sheer: Schema.Finite,
  square: Schema.Finite,
  transom: Schema.Finite,
});
export type HullLines = typeof HullLinesSchema.Type;

/** Stations from the transom to the stem. */
const STATIONS = 48;

/** Points across one band of a section, from one side to the other. */
const ACROSS = 14;

/** Eases from 0 to 1 as `value` crosses from `from` to `to`. */
function ease(from: number, to: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/**
 * The hull at one station, `along` running from 0 at the transom to 1 at the
 * stem: its half-breadth at the deck, the heights of its keel and its deck,
 * how square its section is there, and how far forward its stem leans.
 */
export function stationAt(lines: HullLines, along: number) {
  const fore = ease(1 - lines.bow, 1, along);
  const aft = 1 - ease(0, lines.run, along);
  const fine = Math.sqrt(Math.max(0, 1 - fore ** 1.6));
  const half = (lines.beam / 2) * fine * (1 - aft * (1 - lines.transom));
  return {
    deck: lines.depth * (1 + lines.sheer * fore ** 2),
    half,
    keel: lines.depth * lines.forefoot * fore ** 3,
    lean: lines.depth * lines.rake * fore,
    square: 2 + (lines.square - 2) * (1 - fore) * (1 - 0.5 * aft),
  };
}

/**
 * The point of a station's section at `s`, from 0 at the keel to 1 at the
 * deck edge, on one side: a superellipse quadrant, round where the exponent
 * is 2 and boxy with a tight bilge where it is larger.
 */
function sectionAt(station: ReturnType<typeof stationAt>, s: number) {
  const angle = (s * Math.PI) / 2;
  const power = 2 / station.square;
  const out = Math.sin(angle) ** power;
  const down = Math.cos(angle) ** power;
  return {
    y: station.deck - (station.deck - station.keel) * down,
    z: station.half * out,
  };
}

/** The section parameter where the side reaches `height`, or its end when the side never does. */
function sectionAtHeight(
  station: ReturnType<typeof stationAt>,
  height: number
) {
  let low = 0;
  let high = 1;
  for (let step = 0; step < 30; step += 1) {
    const middle = (low + high) / 2;
    if (sectionAt(station, middle).y < height) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

/** One point of the hull's surface, with its texture coordinates in scene units. */
const PointSchema = Schema.Struct({
  u: Schema.Finite,
  v: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});
type Point = typeof PointSchema.Type;

/**
 * The band of one station's section between two heights, from the port deck
 * edge round under the keel to the starboard deck edge.
 */
function ringAt(lines: HullLines, along: number, from: number, to: number) {
  const station = stationAt(lines, along);
  const decked = to >= station.deck;
  const lowest = sectionAtHeight(station, from);
  const highest = decked ? 1 : sectionAtHeight(station, to);
  const x = -lines.length / 2 + along * lines.length;
  const pointAt = (column: number): Point => {
    const side = column < ACROSS ? -1 : 1;
    const s =
      lowest + ((highest - lowest) * Math.abs(column - ACROSS)) / ACROSS;
    const point = sectionAt(station, s);
    const rise = (point.y - station.keel) / (station.deck - station.keel);
    return {
      u: x + lines.length / 2,
      v: point.y,
      x: x + station.lean * rise,
      y: point.y,
      z: side * point.z,
    };
  };
  return Arr.makeBy(ACROSS * 2 + 1, pointAt);
}

/**
 * One geometry from its points, its triangles as runs of three point
 * indices, and how many indices belong to the first group; the rest are the
 * second.
 */
function buildGeometry(
  points: readonly Point[],
  indices: readonly number[],
  shell: number
) {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      Arr.flatMap(points, (point) => [point.x, point.y, point.z]),
      3
    )
  );
  geometry.setAttribute(
    "uv",
    new Float32BufferAttribute(
      Arr.flatMap(points, (point) => [point.u, point.v]),
      2
    )
  );
  geometry.setIndex([...indices]);
  geometry.addGroup(0, shell, 0);
  geometry.addGroup(shell, indices.length - shell, 1);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * The shell of a hull between two heights, as a closed surface: the band
 * from `from` to `to` on both sides, joined under the keel when the band
 * reaches it, with the transom closing its stern and, when the band reaches
 * the deck, the deck closing its top. Shell, transom and deck have their own
 * vertices, so each keeps a crisp edge where they meet. The hull lies along
 * +x with its stem forward, its keel amidships at zero and its centreline at
 * z = 0. The shell and transom are its first group, the deck its second, so
 * the deck takes its own material. Texture coordinates are in scene units,
 * so a surface keeps its real size: along and up the shell, along and across
 * the deck.
 *
 * @param lines - The hull's lines
 * @param from - The lowest height of the band
 * @param to - The highest height of the band; at or above the deck, the deck closes it
 */
export function hullGeometry(lines: HullLines, from: number, to: number) {
  const rings = Arr.makeBy(STATIONS + 1, (row) =>
    ringAt(lines, row / STATIONS, from, to)
  );
  const columns = ACROSS * 2 + 1;
  const shellPoints = Arr.flatten(rings);
  const shellFaces = Arr.flatMap(Arr.range(0, STATIONS - 1), (row) =>
    Arr.flatMap(Arr.range(0, columns - 2), (column) => {
      const a = row * columns + column;
      const b = a + columns;
      return [a, b, a + 1, a + 1, b, b + 1];
    })
  );

  const stern = Arr.headNonEmpty(rings);
  const port = Arr.headNonEmpty(stern);
  const keel = Arr.reduce(stern, port.y, (low, point) =>
    Math.min(low, point.y)
  );
  const middle = (port.y + keel) / 2;
  const centre = shellPoints.length;
  const base = centre + 1;
  const decked = to >= lines.depth * (1 + lines.sheer);
  const transomFaces = Arr.flatMap(Arr.range(0, columns - 2), (column) => [
    centre,
    base + column,
    base + column + 1,
  ]);
  const topFace = decked ? [base, centre, base + columns - 1] : [];
  const firstDeck = base + columns;
  const deckFaces = decked
    ? Arr.flatMap(Arr.range(0, STATIONS - 1), (row) => {
        const here = firstDeck + row * 2;
        const next = here + 2;
        return [here, here + 1, next, next, here + 1, next + 1];
      })
    : [];
  const deckPoints = decked
    ? Arr.flatMap(rings, (ring) =>
        Arr.map([Arr.headNonEmpty(ring), Arr.lastNonEmpty(ring)], (point) => ({
          ...point,
          v: point.z,
        }))
      )
    : [];

  const points = [
    ...shellPoints,
    { ...port, v: middle, y: middle, z: 0 },
    ...stern,
    ...deckPoints,
  ];
  const shell = [...shellFaces, ...transomFaces, ...topFace];
  return buildGeometry(points, [...shell, ...deckFaces], shell.length);
}

/**
 * The hull's deck edge as points from the port quarter round the stem to the
 * starboard quarter, raised by `rise` and set out from the side by `out`:
 * the line a rubbing strake, a fender or a cap rail follows.
 */
export function deckEdge(lines: HullLines, rise: number, out: number) {
  const stations = Arr.makeBy(STATIONS + 1, (row) => {
    const along = row / STATIONS;
    const station = stationAt(lines, along);
    return {
      x: -lines.length / 2 + along * lines.length + station.lean,
      y: station.deck + rise,
      z: station.half + out,
    };
  });
  const port = Arr.map(
    stations,
    (point) => [point.x, point.y, -point.z] as const
  );
  const starboard = Arr.map(
    Arr.reverse(stations),
    (point) => [point.x, point.y, point.z] as const
  );
  return Arr.appendAll(port, Arr.drop(starboard, 1));
}

/** The deck's height at `x` along the hull, from the transom at -length/2 to the stem at +length/2. */
export function deckAt(lines: HullLines, x: number) {
  return stationAt(lines, x / lines.length + 0.5).deck;
}

/** The half-breadth of the deck at `x` along the hull. */
export function halfAt(lines: HullLines, x: number) {
  return stationAt(lines, x / lines.length + 0.5).half;
}
