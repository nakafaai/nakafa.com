/**
 * Reads the text of an SVG path into the places it draws, for her tests: every
 * command of the path grammar, absolute or relative, each curve and arc as
 * straight pieces.
 */
import { cubic } from "@repo/mascot/nina/limb";
import type { Place } from "@repo/mascot/nina/point";
import { Array as Arr, Match, Schema } from "effect";

/** How many straight pieces stand in for a curve. */
const PIECES = 12;
const COMMAND = /(?<command>[MLHVCSQTAZ])(?<values>[^MLHVCSQTAZ]*)/giu;
const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/giu;
/** How many numbers each command takes for one stretch it draws: more numbers repeat it. */
const ARITY: Readonly<Record<string, number>> = {
  A: 7,
  C: 6,
  H: 1,
  L: 2,
  M: 2,
  Q: 4,
  S: 4,
  T: 2,
  V: 1,
  Z: 0,
};

const PlaceSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);

/**
 * A pen while it draws a path: where it is, where the piece in hand began, the
 * pieces done, the piece in hand as the runs of places it was drawn in, and the
 * last control place of a curve, which a smooth curve after it mirrors.
 */
const PenSchema = Schema.Struct({
  at: PlaceSchema,
  begin: PlaceSchema,
  control: Schema.NullOr(
    Schema.Struct({ cubic: Schema.Boolean, at: PlaceSchema })
  ),
  done: Schema.Array(Schema.Array(PlaceSchema)),
  piece: Schema.Array(Schema.Array(PlaceSchema)),
});

type Pen = typeof PenSchema.Type;

/** Reads the numbers of a text, in order. */
export function numbersOf(text: string) {
  return Arr.map(Arr.fromIterable(text.matchAll(NUMBER)), ([found]) =>
    Number(found)
  );
}

/** The numbers of a list, two by two, as places. */
export function placesOf(numbers: readonly number[]): readonly Place[] {
  return Arr.map(Arr.chunksOf(numbers, 2), ([x, y]): Place => [x, y]);
}

/** One coordinate of a quadratic curve with these three control values, at `t`. */
function quadratic(a: number, b: number, c: number, t: number) {
  const m = 1 - t;
  return m * m * a + 2 * m * t * b + t * t * c;
}

/** The places along a curve from `from` through its control places, the last of which it reaches: two for a quadratic curve, three for a cubic. */
function curveFrom(from: Place, controls: readonly Place[]): readonly Place[] {
  return Arr.makeBy(PIECES, (i): Place => {
    const t = (i + 1) / PIECES;
    const [b, c, d] = controls;
    return d === undefined
      ? [quadratic(from[0], b[0], c[0], t), quadratic(from[1], b[1], c[1], t)]
      : [
          cubic(from[0], b[0], c[0], d[0], t),
          cubic(from[1], b[1], c[1], d[1], t),
        ];
  });
}

/** How far an arc turns, in radians: the turn between its ends, taken the way its sweep flag says. */
function sweptSpan(raw: number, clockwise: boolean) {
  if (!clockwise && raw > 0) {
    return raw - 2 * Math.PI;
  }
  if (clockwise && raw < 0) {
    return raw + 2 * Math.PI;
  }
  return raw;
}

/** The places along an elliptical arc from `from` to `to`, as SVG draws it: its centre found from its radii and flags. */
function arcFrom(
  from: Place,
  [rx0, ry0, tilt, large, sweep]: readonly number[],
  to: Place
): readonly Place[] {
  // An arc without a radius is a straight line, as SVG says.
  if (rx0 === 0 || ry0 === 0) {
    return [to];
  }
  const turn = (tilt * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const hx = (from[0] - to[0]) / 2;
  const hy = (from[1] - to[1]) / 2;
  const x1 = cos * hx + sin * hy;
  const y1 = -sin * hx + cos * hy;
  // Radii too small to reach grow until they just do, as SVG says.
  const reach = Math.sqrt(Math.max(1, x1 ** 2 / rx0 ** 2 + y1 ** 2 / ry0 ** 2));
  const rx = Math.abs(rx0) * reach;
  const ry = Math.abs(ry0) * reach;
  const sign = large === sweep ? -1 : 1;
  const root =
    sign *
    Math.sqrt(
      Math.max(
        0,
        (rx ** 2 * ry ** 2 - rx ** 2 * y1 ** 2 - ry ** 2 * x1 ** 2) /
          (rx ** 2 * y1 ** 2 + ry ** 2 * x1 ** 2)
      )
    );
  const cx1 = (root * rx * y1) / ry;
  const cy1 = (-root * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (from[0] + to[0]) / 2;
  const cy = sin * cx1 + cos * cy1 + (from[1] + to[1]) / 2;
  const angle = (ux: number, uy: number) => Math.atan2(uy, ux);
  const begin = angle((x1 - cx1) / rx, (y1 - cy1) / ry);
  const raw = angle((-x1 - cx1) / rx, (-y1 - cy1) / ry) - begin;
  const span = sweptSpan(raw, sweep !== 0);
  // Four times the places of a curve, so the widest reach of a long arc is among them to a hair.
  const steps = PIECES * 4;
  return Arr.makeBy(steps, (i): Place => {
    const at = begin + (span * (i + 1)) / steps;
    const ex = rx * Math.cos(at);
    const ey = ry * Math.sin(at);
    return [cx + cos * ex - sin * ey, cy + sin * ex + cos * ey];
  });
}

/** Moves a pen by one stretch of a path: an absolute command and the numbers of one stretch. */
function stroke(pen: Pen, command: string, numbers: readonly number[]): Pen {
  const places = placesOf(numbers);
  const end = (added: readonly Place[]) =>
    Arr.reduce(added, pen.at, (_, place) => place);
  const more = (
    added: readonly Place[],
    control: Pen["control"] = null
  ): Pen => ({
    ...pen,
    at: end(added),
    control,
    piece: [...pen.piece, added],
  });
  const mirrored = (cubicCurve: boolean): Place =>
    pen.control !== null && pen.control.cubic === cubicCurve
      ? [2 * pen.at[0] - pen.control.at[0], 2 * pen.at[1] - pen.control.at[1]]
      : pen.at;
  return Match.value(command).pipe(
    Match.when("M", () => ({
      ...pen,
      at: places[0],
      begin: places[0],
      control: null,
      done: [...pen.done, Arr.flatten(pen.piece)],
      piece: [places],
    })),
    Match.when("H", () => more([[numbers[0], pen.at[1]]])),
    Match.when("V", () => more([[pen.at[0], numbers[0]]])),
    Match.when("L", () => more(places)),
    Match.when("Z", () => more([pen.begin])),
    Match.when("C", () =>
      more(curveFrom(pen.at, places), { at: places[1], cubic: true })
    ),
    Match.when("S", () => {
      const first = mirrored(true);
      return more(curveFrom(pen.at, [first, ...places]), {
        at: places[0],
        cubic: true,
      });
    }),
    Match.when("Q", () =>
      more(curveFrom(pen.at, places), { at: places[0], cubic: false })
    ),
    Match.when("T", () => {
      const control = mirrored(false);
      return more(curveFrom(pen.at, [control, places[0]]), {
        at: control,
        cubic: false,
      });
    }),
    // The command left is the arc.
    Match.orElse(() => more(arcFrom(pen.at, numbers, [numbers[5], numbers[6]])))
  );
}

/** Makes the numbers of one stretch absolute, from where the pen is: a lower-case command counts from there. */
function absolute(command: string, numbers: readonly number[], at: Place) {
  if (command === command.toUpperCase()) {
    return numbers;
  }
  return Match.value(command.toUpperCase()).pipe(
    Match.when("H", () => [numbers[0] + at[0]]),
    Match.when("V", () => [numbers[0] + at[1]]),
    Match.when("A", () => [
      ...Arr.take(numbers, 5),
      numbers[5] + at[0],
      numbers[6] + at[1],
    ]),
    Match.orElse(() =>
      Arr.map(numbers, (value, i) => value + at[i % 2 === 0 ? 0 : 1])
    )
  );
}

/** Moves a pen by one command of a path, each stretch its numbers repeat in turn. */
function draw(pen: Pen, [, written, text]: RegExpExecArray): Pen {
  const upper = written.toUpperCase();
  const arity = ARITY[upper];
  const numbers = numbersOf(text);
  if (arity === 0) {
    return stroke(pen, upper, []);
  }
  return Arr.reduce(Arr.chunksOf(numbers, arity), pen, (moved, chunk, i) => {
    // Pairs after a move are lines, as SVG reads them.
    const command = i > 0 && upper === "M" ? "L" : upper;
    const relative = written !== upper;
    return stroke(
      moved,
      command,
      absolute(relative ? command.toLowerCase() : command, chunk, moved.at)
    );
  });
}

/** The pieces that a path draws, each as the places along it. */
export function piecesOf(d: string): readonly (readonly Place[])[] {
  const blank: Pen = {
    at: [0, 0],
    begin: [0, 0],
    control: null,
    done: [],
    piece: [[[0, 0]]],
  };
  const last = Arr.reduce(Arr.fromIterable(d.matchAll(COMMAND)), blank, draw);
  return Arr.filter(
    [...last.done, Arr.flatten(last.piece)],
    (piece) => piece.length > 1
  );
}

/** The places along a path, in the order it draws them. The one reader of path text in her tests. */
export function outlineOf(d: string): readonly Place[] {
  return Arr.flatten(piecesOf(d));
}
