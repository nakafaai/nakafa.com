import { Array as Arr } from "effect";

/** A point of the scene: x to the right, y up, z toward the viewer. */
type Point = readonly [number, number, number];

/** A path of straight pieces, from its first point to its last. */
export type Path = Arr.NonEmptyReadonlyArray<Point>;

/** Half the distance between a cell's two electrodes. */
export const ELECTRODE_OFFSET = 0.2;

/** The height of an electrode's top, where its wire clips on. */
export const ELECTRODE_TOP = 1.07;

/** The height the battery and its two leads run at. */
export const BATTERY_Y = 1.75;

/** Half the battery's width: its terminals sit this far either side of its middle. */
export const TERMINAL_OFFSET = 0.3;

/** The height of the lead that joins one cell to the next in series. */
const LINK_Y = 1.35;

/** How far apart neighbouring cells stand, middle to middle. */
const CELL_SPACING = 1.6;

/** The x of each cell's middle, the row centred on the battery. */
export function cellCentres(count: number) {
  return Arr.makeBy(count, (index) => centreOf(index, count));
}

/**
 * The leads of a circuit of cells in series, each written in the direction
 * electrons travel along it: out of the first anode to the battery's positive
 * terminal, from each anode across to the cathode of the cell before it, and
 * from the negative terminal into the last cathode. Each cell's anode is its
 * left electrode.
 */
export function circuitLeads(count: number): Arr.NonEmptyReadonlyArray<Path> {
  const firstAnode = centreOf(0, count) - ELECTRODE_OFFSET;
  const lastCathode = centreOf(count - 1, count) + ELECTRODE_OFFSET;
  const centres = cellCentres(count);
  const links = Arr.map(
    Arr.zip(centres, Arr.drop(centres, 1)),
    ([left, right]): Path => [
      [right - ELECTRODE_OFFSET, ELECTRODE_TOP, 0],
      [right - ELECTRODE_OFFSET, LINK_Y, 0],
      [left + ELECTRODE_OFFSET, LINK_Y, 0],
      [left + ELECTRODE_OFFSET, ELECTRODE_TOP, 0],
    ]
  );

  return [
    [
      [firstAnode, ELECTRODE_TOP, 0],
      [firstAnode, BATTERY_Y, 0],
      [-TERMINAL_OFFSET, BATTERY_Y, 0],
    ],
    ...links,
    [
      [TERMINAL_OFFSET, BATTERY_Y, 0],
      [lastCathode, BATTERY_Y, 0],
      [lastCathode, ELECTRODE_TOP, 0],
    ],
  ];
}

/**
 * The point a share `progress` of the way along a path, measured by length,
 * so a dot moving at a steady progress keeps a steady speed around corners.
 * A progress outside 0 to 1 wraps around, and a path of one point stays put.
 */
export function pointAlong(path: Path, progress: number): Point {
  const segments = Arr.filter(
    Arr.map(Arr.zip(path, Arr.drop(path, 1)), ([from, to]) => ({
      from,
      length: distance(from, to),
      to,
    })),
    (segment) => segment.length > 0
  );
  const starts = Arr.scan(segments, 0, (sum, segment) => sum + segment.length);
  const pieces = Arr.zipWith(segments, starts, (segment, start) => ({
    ...segment,
    start,
  }));
  const target = (((progress % 1) + 1) % 1) * Arr.lastNonEmpty(starts);
  const passed = Arr.filter(
    pieces,
    (piece) => piece.start + piece.length <= target
  ).length;
  return Arr.match(Arr.drop(pieces, passed), {
    onEmpty: () => Arr.headNonEmpty(path),
    onNonEmpty: ([piece]) => {
      const share = (target - piece.start) / piece.length;
      return [
        piece.from[0] + (piece.to[0] - piece.from[0]) * share,
        piece.from[1] + (piece.to[1] - piece.from[1]) * share,
        piece.from[2] + (piece.to[2] - piece.from[2]) * share,
      ];
    },
  });
}

/** The x of one cell's middle in a row of `count`. */
function centreOf(index: number, count: number) {
  return (index - (count - 1) / 2) * CELL_SPACING;
}

/** The straight distance between two points. */
function distance(from: Point, to: Point) {
  return Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
}
