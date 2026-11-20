import { Array as Arr, Order, Schema } from "effect";

/**
 * The Galton board at real size, in metres, as a school's teaching board is
 * built: a hardwood frame round a pale backboard, brass pins 4 mm across in
 * rows 27 mm apart, steel balls 6 mm across that roll in one plane between
 * the backboard and a glass front, a V-shaped hopper at the top and a row of
 * collecting bins under the pins. The board stands on two feet; y = 0 is the
 * floor under them, x runs across the board and z out of its face.
 */

/** A steel ball bearing's radius: 6 mm balls. */
export const BALL_RADIUS = 0.003;

/** A brass pin's radius: 4 mm pins. */
export const PIN_RADIUS = 0.002;

/** The distance between neighbouring pins in a row, which is also a bin's width. */
export const PITCH = 0.027;

/** The drop from one row of pins to the next, which sets the pins in equilateral triangles. */
export const ROW_GAP = (PITCH * Math.sqrt(3)) / 2;

/** The depth between the backboard and the glass: a little more than one ball, so the balls run in one plane. */
export const GAP = 0.0075;

/** The most rows of pins the board takes. */
export const MAX_ROWS = 12;

/** Half the width inside the frame. */
export const INNER_HALF = 0.185;

/** The height of the feet and of the bins' floor, the top of the base rail. */
export const FOOT_HEIGHT = 0.022;
export const BIN_FLOOR = 0.052;

/** The height of the first row's single pin. */
const FIRST_ROW = 0.47;

/** The height of the hopper's outlet, and half its opening: wide enough for one ball. */
export const NECK = FIRST_ROW + 0.035;
export const NECK_HALF = 0.0042;

/** The hopper's floor rises at 30 degrees from the outlet, steep enough for steel balls to roll down it. */
export const HOPPER_SLOPE = Math.PI / 6;

/** The height inside the frame's top rail. */
export const INNER_TOP = 0.63;

/** The thickness of a bin's divider. */
export const DIVIDER = 0.0015;

/** The centre of each foot across the board, and a foot's width. */
export const FOOT_X = 0.16;
export const FOOT_WIDTH = 0.03;

/** One point on the board's face. */
const BoardPointSchema = Schema.Struct({ x: Schema.Finite, y: Schema.Finite });
export type BoardPoint = typeof BoardPointSchema.Type;

/** The centre of pin `index` of row `row` (both from 0); a row holds one more pin than the row above. */
export function pinPoint(row: number, index: number): BoardPoint {
  return { x: (index - row / 2) * PITCH, y: FIRST_ROW - row * ROW_GAP };
}

/** Every pin of a board with `rows` rows, top row first. */
export function pinPoints(rows: number) {
  return Arr.flatMap(Arr.range(0, rows - 1), (row) =>
    Arr.map(Arr.range(0, row), (index) => pinPoint(row, index))
  );
}

/** Where a ball's centre rests on top of pin `index` of row `row`. */
export function contactPoint(row: number, index: number): BoardPoint {
  const pin = pinPoint(row, index);
  return { x: pin.x, y: pin.y + PIN_RADIUS + BALL_RADIUS };
}

/** The centre of bin `bin` (0 to `rows`) across the board. */
export function binCentre(rows: number, bin: number) {
  return (bin - rows / 2) * PITCH;
}

/**
 * The top of the bins' dividers: half a row under the last pins, low enough
 * that a ball leaving a last pin clears the divider beneath it.
 */
export function dividerTop(rows: number) {
  return FIRST_ROW - (rows - 0.5) * ROW_GAP;
}

/** Where each divider stands across the board: one between every two bins and one at each end. */
export function dividerXs(rows: number) {
  return Arr.map(Arr.range(0, rows + 1), (index) =>
    binCentre(rows, index - 0.5)
  );
}

/** The rise of one layer of balls stacked in the hollows of the layer below. */
const LAYER_RISE = BALL_RADIUS * Math.sqrt(3);

/** A bin holds four balls side by side, and three in the hollows of the layer over them. */
const WIDE_LAYER = 4;
const PAIR = 7;

/**
 * Where the `index`-th ball (from 0) to land in bin `bin` comes to rest:
 * four balls across the bottom layer, three in its hollows above, and so on,
 * so no two balls ever overlap.
 */
export function stackPoint(rows: number, bin: number, index: number) {
  const pair = Math.floor(index / PAIR);
  const place = index % PAIR;
  const upper = place >= WIDE_LAYER;
  const slot = upper ? place - WIDE_LAYER - 1 : place - 1.5;
  return {
    x: binCentre(rows, bin) + slot * 2 * BALL_RADIUS,
    y: BIN_FLOOR + BALL_RADIUS + (pair * 2 + (upper ? 1 : 0)) * LAYER_RISE,
  };
}

/**
 * The height of the top of a pile of `count` balls in a bin, read as a
 * smooth level: where a mark for an expected count stands.
 */
export function pileLevel(count: number) {
  return (
    BIN_FLOOR +
    (Math.max(count, 0) / (PAIR / 2)) * LAYER_RISE +
    2 * BALL_RADIUS -
    LAYER_RISE
  );
}

/**
 * How far from the middle a ball's centre may sit at height `y` in the
 * hopper: clear of the floor that rises at 30 degrees from the outlet, and
 * of the frame's sides.
 */
function hopperReach(y: number) {
  const floor =
    NECK_HALF +
    ((y - NECK) * Math.cos(HOPPER_SLOPE) - BALL_RADIUS) /
      Math.sin(HOPPER_SLOPE);
  return Math.min(floor, INNER_HALF - BALL_RADIUS);
}

/** Every place a ball can rest in the hopper, packed in layers from the outlet up, the lowest and most central first. */
const HOPPER_SLOTS: readonly BoardPoint[] = Arr.sort(
  Arr.flatMap(
    Arr.range(0, Math.floor((INNER_TOP - NECK - 2 * BALL_RADIUS) / LAYER_RISE)),
    (layer) => {
      const y = NECK + BALL_RADIUS + layer * LAYER_RISE;
      const reach = hopperReach(y);
      const shift = (layer % 2) * BALL_RADIUS;
      const across = Math.floor(INNER_HALF / (2 * BALL_RADIUS)) + 1;
      return Arr.filter(
        Arr.map(Arr.range(-across, across), (slot) => ({
          x: slot * 2 * BALL_RADIUS + shift,
          y,
        })),
        (point) => Math.abs(point.x) <= reach + 1e-9
      );
    }
  ),
  Order.combine(
    Order.mapInput(Order.Number, (point: BoardPoint) => point.y),
    Order.mapInput(Order.Number, (point: BoardPoint) => Math.abs(point.x))
  )
);

/** The places of the `count` balls still waiting in the hopper. */
export function hopperPoints(count: number) {
  return Arr.take(HOPPER_SLOTS, count);
}

/**
 * The lean of the board when its bounces are biased. A teacher biases a
 * real board by leaning it: gravity then pulls each ball along the rows
 * toward the low side. How far a given lean moves p depends on the pins and
 * the balls, so the lean here is a sign of the bias, 5 degrees toward the
 * favoured side, and p alone decides every bounce.
 */
export const LEAN = (5 * Math.PI) / 180;

/**
 * How the board stands for bias `p`: the angle it turns by (negative leans
 * its right side down), the floor point it pivots on, the outer foot corner
 * on its low side, and the wedge under its raised foot, as the corners of
 * its side face: its top lies along the raised foot's sole.
 */
export function boardPose(p: number) {
  const side = Math.sign(p - 0.5);
  if (side === 0) {
    return { angle: 0, pivot: 0, wedge: [] };
  }
  const pivot = side * (FOOT_X + FOOT_WIDTH / 2);
  const outer = -side * (FOOT_X + FOOT_WIDTH / 2 + 0.012);
  const inner = -side * (FOOT_X - FOOT_WIDTH / 2 - 0.035);
  const rise = (x: number) => Math.abs(x - pivot) * Math.tan(LEAN);
  return {
    angle: -side * LEAN,
    pivot,
    wedge: [
      { x: outer, y: 0 },
      { x: inner, y: 0 },
      { x: inner, y: rise(inner) },
      { x: outer, y: rise(outer) },
    ],
  };
}
