import { cubic } from "@repo/mascot/nina/limb";
import type { Place } from "@repo/mascot/nina/point";
import type { Shape } from "@repo/mascot/shape";
import { Array as Arr, Match, Number as Num, Option, Schema } from "effect";

/** How many straight pieces stand in for a curve. */
const PIECES = 12;
const COMMAND = /([MLHVCQZ])([^MLHVCQZ]*)/gu;
const NUMBER = /-?\d+(?:\.\d+)?/gu;
const CALL = /(translate|rotate|scale)\(([^)]*)\)/gu;

const PlaceSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);

/**
 * A pen while it draws a path: where it is, where the piece in hand began, the
 * pieces done, and the piece in hand as the runs of places it was drawn in.
 */
const PenSchema = Schema.Struct({
  at: PlaceSchema,
  begin: PlaceSchema,
  done: Schema.Array(Schema.Array(PlaceSchema)),
  piece: Schema.Array(Schema.Array(PlaceSchema)),
});

type Pen = typeof PenSchema.Type;

/** Reads the numbers of a text, in order. */
function numbersOf(text: string) {
  return Arr.map(Arr.fromIterable(text.matchAll(NUMBER)), ([found]) =>
    Number(found)
  );
}

/** The numbers of a list, two by two, as places. */
function placesOf(numbers: readonly number[]): readonly Place[] {
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

/** Moves a pen by one command of a path. */
function draw(pen: Pen, [, command, text]: RegExpExecArray): Pen {
  const numbers = numbersOf(text);
  const places = placesOf(numbers);
  const more = (added: readonly Place[]): Pen => ({
    ...pen,
    at: Arr.reduce(added, pen.at, (_, place) => place),
    piece: [...pen.piece, added],
  });
  return Match.value(command).pipe(
    Match.when("M", () => ({
      ...more(places),
      begin: places[0],
      done: [...pen.done, Arr.flatten(pen.piece)],
      piece: [places],
    })),
    Match.when("H", () => more([[numbers[0], pen.at[1]]])),
    Match.when("V", () => more([[pen.at[0], numbers[0]]])),
    Match.when("L", () => more(places)),
    Match.when("Z", () => more([pen.begin])),
    // The commands left are the curves, quadratic or cubic by their places.
    Match.orElse(() => more(curveFrom(pen.at, places)))
  );
}

/** The pieces that a path draws, each as the places along it. */
function piecesOf(d: string): readonly (readonly Place[])[] {
  const blank: Pen = { at: [0, 0], begin: [0, 0], done: [], piece: [[[0, 0]]] };
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

/** Whether a place is inside an outline, counting how often a ray from it crosses the outline. */
function inside(outline: readonly Place[], [x, y]: Place) {
  return Arr.reduce(
    Arr.zip(outline, [...Arr.drop(outline, 1), outline[0]]),
    false,
    (within, [a, b]) =>
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
        ? !within
        : within
  );
}

/** How far a place is from a line segment. */
function apart([x, y]: Place, a: Place, b: Place) {
  const along = Num.clamp(
    ((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) /
      ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1),
    { maximum: 1, minimum: 0 }
  );
  return Math.hypot(
    x - (a[0] + (b[0] - a[0]) * along),
    y - (a[1] + (b[1] - a[1]) * along)
  );
}

/** Whether a place is within half a width of a line made of segments. */
function touches(line: readonly Place[], at: Place, width: number) {
  return Arr.some(
    Arr.zip(line, Arr.drop(line, 1)),
    ([a, b]) => apart(at, a, b) <= width / 2
  );
}

/** A transform function with all its numbers: a translation, a scale, or a rotation in degrees about a place. */
type Call = readonly [name: string, a: number, b: number, c: number];

/** Reads one transform function, giving the numbers it leaves out their default. */
function callOf([, name, text]: RegExpExecArray): Call {
  const [a, b, c] = numbersOf(text);
  return Match.value(name).pipe(
    Match.when("translate", (): Call => [name, a, b ?? 0, 0]),
    Match.when("scale", (): Call => [name, a, b ?? a, 0]),
    // The last transform function that the pictures use is the rotation.
    Match.orElse((): Call => [name, a, b ?? 0, c ?? 0])
  );
}

/** The transform functions of the groups that a shape lies in, the outermost first. */
function callsOf(transforms: readonly string[]): readonly Call[] {
  return Arr.flatMap(transforms, (transform) =>
    Arr.map(Arr.fromIterable(transform.matchAll(CALL)), callOf)
  );
}

/** Undoes one transform function, so that a place outside a group becomes a place inside it. */
function undo(at: Place, [name, a, b, c]: Call): Place {
  return Match.value(name).pipe(
    Match.when("translate", (): Place => [at[0] - a, at[1] - b]),
    Match.when("scale", (): Place => [at[0] / a, at[1] / b]),
    Match.orElse((): Place => {
      const turn = (a * Math.PI) / 180;
      const dx = at[0] - b;
      const dy = at[1] - c;
      return [
        b + dx * Math.cos(turn) + dy * Math.sin(turn),
        c - dx * Math.sin(turn) + dy * Math.cos(turn),
      ];
    })
  );
}

/** A shape and the test of whether it lies over a place. */
interface Layer<Mark> {
  readonly covers: (at: Place) => boolean;
  readonly shape: Shape<Mark>;
}

/** What a kind of shape covers: the places that bound it, and the test inside. */
interface Cover {
  readonly bound: readonly Place[];
  readonly covers: (at: Place) => boolean;
}

/** The two opposite corners of a box, as the places that bound a shape. */
function corners(
  left: number,
  top: number,
  right: number,
  bottom: number
): readonly Place[] {
  return [
    [left, top],
    [right, bottom],
  ];
}

/** The shapes that paint, in the order they are drawn. */
function layersOf<Mark>(
  shapes: readonly Shape<Mark>[],
  outer: readonly string[]
): readonly Layer<Mark>[] {
  return Arr.flatMap(shapes, (shape): readonly Layer<Mark>[] => {
    const here =
      shape.transform === undefined ? outer : [...outer, shape.transform];
    if (shape._tag === "g") {
      return layersOf(shape.children, here);
    }
    // SVG fills with black unless a shape says "none".
    const filled = shape.fill !== "none";
    const stroked = shape.stroke !== undefined && shape.stroke !== "none";
    const width = shape.strokeWidth ?? 1;
    const grow = stroked ? width / 2 : 0;
    const cover: Cover = Match.value(shape).pipe(
      Match.tag("path", ({ d }) => {
        const pieces = piecesOf(d);
        return {
          bound: Arr.flatten(pieces),
          covers: (at: Place) =>
            (filled && Arr.some(pieces, (piece) => inside(piece, at))) ||
            (stroked && Arr.some(pieces, (piece) => touches(piece, at, width))),
        };
      }),
      Match.tag("polygon", ({ points }) => {
        const outline = placesOf(numbersOf(points));
        return {
          bound: outline,
          covers: (at: Place) =>
            (filled && inside(outline, at)) ||
            (stroked && touches([...outline, outline[0]], at, width)),
        };
      }),
      // A rectangle and an ellipse count by their fill: she strokes neither.
      Match.tag("rect", ({ height, rx = 0, width: across, x = 0, y = 0 }) => ({
        bound: corners(x, y, x + across, y + height),
        covers: (at: Place) =>
          filled &&
          Math.hypot(
            at[0] -
              Num.clamp(at[0], { maximum: x + across - rx, minimum: x + rx }),
            at[1] -
              Num.clamp(at[1], { maximum: y + height - rx, minimum: y + rx })
          ) <= rx,
      })),
      Match.tag("circle", ({ cx, cy, r }) => ({
        bound: corners(cx - r, cy - r, cx + r, cy + r),
        covers: (at: Place) => {
          const gap = Math.hypot(at[0] - cx, at[1] - cy);
          return (
            (filled && gap <= r + grow) ||
            (stroked && Math.abs(gap - r) <= width / 2)
          );
        },
      })),
      Match.tag("ellipse", ({ cx, cy, rx, ry }) => ({
        bound: corners(cx - rx, cy - ry, cx + rx, cy + ry),
        covers: (at: Place) =>
          filled && ((at[0] - cx) / rx) ** 2 + ((at[1] - cy) / ry) ** 2 <= 1,
      })),
      Match.exhaustive
    );
    const xs = Arr.map(cover.bound, ([x]) => x);
    const ys = Arr.map(cover.bound, ([, y]) => y);
    const left = Math.min(...xs) - grow;
    const right = Math.max(...xs) + grow;
    const top = Math.min(...ys) - grow;
    const bottom = Math.max(...ys) + grow;
    const calls = callsOf(here);
    return [
      {
        covers: (at) => {
          const [x, y] = Arr.reduce(calls, at, undo);
          return (
            x >= left &&
            x <= right &&
            y >= top &&
            y <= bottom &&
            cover.covers([x, y])
          );
        },
        shape,
      },
    ];
  });
}

/**
 * Finds what is on top at a place of a picture, as a browser does when it is
 * asked which element lies there: through the groups and their transforms, the
 * shape drawn last, a stroke counting as well as a fill. Answers the shape, or
 * nothing when the place is empty.
 */
export function hitter<Mark>(shapes: readonly Shape<Mark>[]) {
  const layers = layersOf(shapes, []);
  return (x: number, y: number): Option.Option<Shape<Mark>> =>
    Option.map(
      Arr.findLast(layers, ({ covers }) => covers([x, y])),
      ({ shape }) => shape
    );
}
