import { Array as Arr, type Option, Order, Schema } from "effect";

/**
 * Where everything lies on the table, in metres, with the table's top at
 * y = 0. A model road runs from the front of the table to the back, and a
 * sheet of graph paper lies to its right, its distance axis running the same
 * way as the road and to the same scale: a bus that is 12 km from the start
 * stands level with the 12 km line of the graph, so a thread pulled straight
 * across from the bus meets the graph where its line is. The time axis runs
 * across the sheet, from left to right.
 */

/**
 * How the graph lies on the table: its axes' origin, how wide and deep its
 * grid is, and how many small squares lie between two numbered lines across
 * and back.
 */
const SheetSchema = Schema.Struct({
  depth: Schema.Finite,
  front: Schema.Finite,
  left: Schema.Finite,
  squares: Schema.Struct({ across: Schema.Finite, back: Schema.Finite }),
  width: Schema.Finite,
});
export type Sheet = typeof SheetSchema.Type;

/** The tops of the graph's axes, in kilometres and minutes. */
const TopsSchema = Schema.Struct({ km: Schema.Finite, minute: Schema.Finite });
export type Tops = typeof TopsSchema.Type;

/** A place on the table: across and back, in metres. */
const SpotSchema = Schema.Struct({ x: Schema.Finite, z: Schema.Finite });
export type Spot = typeof SpotSchema.Type;

/** How far the paper reaches past the grid on each side, for the numbers and the names of the axes. */
export const PAPER = {
  back: 0.075,
  front: 0.115,
  left: 0.08,
  right: 0.045,
} as const;

/**
 * How high each layer of ink lies over the table, in metres: the paper's top,
 * then its grid, its axes, a traveller's whole route faint, the part already
 * travelled, the guides of the leg in focus, and the moving dot, each a hair
 * over the last so none flickers through another. A thread is tied to a
 * vehicle at `thread` and runs down to the dot.
 */
export const INK = {
  axis: 0.001,
  dot: 0.0019,
  ghost: 0.0012,
  grid: 0.0008,
  guide: 0.0016,
  paper: 0.0006,
  thread: 0.012,
  trace: 0.0014,
} as const;

/**
 * The model road: the green board it lies on, the asphalt, how far each lane
 * lies from the middle, and the gap between the board and the paper.
 */
export const BOARD = {
  asphalt: 0.064,
  gap: 0.022,
  lane: 0.016,
  width: 0.13,
} as const;

/** How far the road runs on past the graph at each end, so it never stops in view. */
export const RUN_ON = 0.09;

/** The room the grid may take on a narrow card and on a wide one, before its squares are fitted to it. */
const ROOM = {
  narrow: { depth: 0.9, front: 0.36, left: -0.12, width: 0.56 },
  wide: { depth: 0.78, front: 0.32, left: -0.28, width: 0.92 },
} as const;

/** How many small squares the paper may print between two numbered lines, so each square is a round share of the step. */
const SQUARES = [5, 10] as const;

/** How finely two grids' areas are told apart, in square metres, so two that fill the room alike tie. */
const FILL = 1e-6;

/**
 * The grid of the graph, for axes of `steps` numbered steps: deeper than wide
 * on a narrow card and wider than deep on a wide one, so the road and the
 * graph fill either card. Its small squares are true squares, as on real
 * graph paper, five or ten of them to each numbered step: of those choices
 * it takes the grid that fills most of the room, the one with the larger
 * squares on a tie.
 */
export function sheetOf(
  narrow: boolean,
  steps: { readonly km: number; readonly minute: number }
): Sheet {
  const room = narrow ? ROOM.narrow : ROOM.wide;
  const grids = Arr.flatMap(SQUARES, (across) =>
    Arr.map(SQUARES, (back) => {
      const side = Math.min(
        room.width / (steps.minute * across),
        room.depth / (steps.km * back)
      );
      return {
        depth: steps.km * back * side,
        side,
        squares: { across, back },
        width: steps.minute * across * side,
      };
    })
  );
  const grid = Arr.headNonEmpty(
    Arr.sort(
      grids,
      Order.combine(
        Order.mapInput(
          Order.flip(Order.Number),
          (each: (typeof grids)[number]) =>
            Math.round((each.width * each.depth) / FILL)
        ),
        Order.mapInput(
          Order.flip(Order.Number),
          (each: (typeof grids)[number]) => each.side
        )
      )
    )
  );
  return {
    depth: grid.depth,
    front: room.front,
    left: room.left,
    squares: grid.squares,
    width: grid.width,
  };
}

/** Where a moment of the journey lies on the graph: `minute` across and `km` back, against the axes' tops. */
export function graphSpot(
  sheet: Sheet,
  tops: { readonly km: number; readonly minute: number },
  minute: number,
  km: number
): Spot {
  return {
    x: sheet.left + (minute / tops.minute) * sheet.width,
    z: sheet.front - (km / tops.km) * sheet.depth,
  };
}

/** The middle of the road, across the table. */
export function roadX(sheet: Sheet) {
  return sheet.left - PAPER.left - BOARD.gap - BOARD.width / 2;
}

/**
 * Where a vehicle drives across the road, by which way it faces, from 0 away
 * from the start to 1 back toward it. Traffic keeps to the left, as on the
 * roads of Malaysia and Indonesia, so a bus heading away keeps to the left
 * lane, seen from the start, and moves over as it turns round.
 */
export function laneX(sheet: Sheet, facing: number) {
  return roadX(sheet) + BOARD.lane * (2 * facing - 1);
}

/** How far the road, its stops and the paper reach on the table, which the camera keeps in view. */
export function reachOf(sheet: Sheet) {
  return {
    back: sheet.front - sheet.depth - PAPER.back,
    front: sheet.front + PAPER.front,
    left: roadX(sheet) - BOARD.width / 2,
    right: sheet.left + sheet.width + PAPER.right,
  };
}

/** How far apart the roadside trees stand, and how far they keep from a bus stop, in metres. */
const TREES = { clear: 0.042, gap: 0.085 } as const;

/** Where the roadside trees stand along the road, from `back` to `front`, leaving room for every stop. */
export function treeSpots(
  back: number,
  front: number,
  stops: readonly number[]
) {
  return Arr.filter(
    Arr.makeBy(
      Math.floor((front - back) / TREES.gap),
      (index) => back + (index + 0.5) * TREES.gap
    ),
    (z) => Arr.every(stops, (stop) => Math.abs(stop - z) >= TREES.clear)
  );
}

/** About how wide a stop's name is drawn, in pixels: each character, and the space round the name. */
const NAME = { glyph: 7.2, room: 16 } as const;

/** About how many pixels the longest stop name takes beside the road; none when there are no stops. */
export function namesWidth(names: readonly string[]) {
  return Arr.match(names, {
    onEmpty: () => 0,
    onNonEmpty: (all) =>
      Math.max(...Arr.map(all, (name) => name.length)) * NAME.glyph + NAME.room,
  });
}

/** How much more of the view the camera leaves round the table's contents. */
const MARGIN = 1.06;

/**
 * Where the camera stands: its target in the middle of what it shows, and how
 * far back it stands along a line at `elevation` above the table, so the
 * road, the names of its stops and the paper fit a card of `aspect`. The
 * names are drawn at a fixed size on screen, so their room on the table,
 * `names` pixels of a `width` pixel card, grows as the card narrows. A card
 * taller than wide sees across as much as a square one, as the shared camera
 * widens its view there.
 */
export function viewOf(
  sheet: Sheet,
  frame: {
    readonly aspect: number;
    readonly fov: number;
    readonly names: number;
    readonly width: number;
  },
  elevation: number
) {
  const reach = reachOf(sheet);
  const span = reach.right - reach.left;
  const room = (frame.names * span) / Math.max(frame.width - frame.names, 1);
  const left = reach.left - room;
  const across = (reach.right - left) / 2;
  const deep = (reach.front - reach.back) / 2;
  const slope = Math.tan((frame.fov * Math.PI) / 360);
  const fitAcross =
    across / (slope * Math.max(frame.aspect, 1)) + deep * Math.cos(elevation);
  const fitDeep = (deep * Math.sin(elevation)) / slope;
  return {
    distance: Math.max(fitAcross, fitDeep) * MARGIN,
    target: { x: (left + reach.right) / 2, z: (reach.front + reach.back) / 2 },
  };
}

/**
 * Which way to set a point's letter off its corner of the graph, as a unit
 * step across and back on the table: away from the segments that meet there,
 * so the letter sits outside the bend. A corner on a straight run takes the
 * side above the line, and an end the side away from its one segment. A
 * letter never crosses an axis into its numbers: a corner on the time axis
 * takes the side above it, and one on the distance axis the side to its right.
 */
export function letterSide(
  sheet: Sheet,
  here: Spot,
  before: Option.Option<Spot>,
  after: Option.Option<Spot>
): Spot {
  const toward = (spot: Spot) => {
    const length = Math.hypot(spot.x - here.x, spot.z - here.z);
    return { x: (spot.x - here.x) / length, z: (spot.z - here.z) / length };
  };
  const steps = Arr.map(Arr.getSomes([before, after]), toward);
  const inward = Arr.reduce(steps, { x: 0, z: 0 }, (sum, step) => ({
    x: sum.x + step.x,
    z: sum.z + step.z,
  }));
  const size = Math.hypot(inward.x, inward.z);
  const side =
    size > 1e-6
      ? { x: -inward.x / size, z: -inward.z / size }
      : { x: 0, z: -1 };
  return {
    x: here.x <= sheet.left + 1e-9 ? Math.abs(side.x) : side.x,
    z: here.z >= sheet.front - 1e-9 ? -Math.abs(side.z) : side.z,
  };
}

/** A place on the table at height `y`, as the three numbers a line through it takes. */
export function pointAt(spot: Spot, y: number): [number, number, number] {
  return [spot.x, y, spot.z];
}
