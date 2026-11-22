import type { Place } from "@repo/mascot/nina/point";
import { numbersOf, piecesOf, placesOf } from "@repo/mascot/nina/test.path";
import type { Shape } from "@repo/mascot/shape";
import { Array as Arr, Match, Number as Num, Option } from "effect";

const CALL = /(?<name>translate|rotate|scale)\((?<values>[^)]*)\)/gu;

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

/** Does one transform function, so that a place inside a group becomes a place outside it: the reverse of `undo`. */
function apply(at: Place, [name, a, b, c]: Call): Place {
  return Match.value(name).pipe(
    Match.when("translate", (): Place => [at[0] + a, at[1] + b]),
    Match.when("scale", (): Place => [at[0] * a, at[1] * b]),
    Match.orElse((): Place => {
      const turn = (a * Math.PI) / 180;
      const dx = at[0] - b;
      const dy = at[1] - c;
      return [
        b + dx * Math.cos(turn) - dy * Math.sin(turn),
        c + dx * Math.sin(turn) + dy * Math.cos(turn),
      ];
    })
  );
}

/** A shape and the test of whether it lies over a place. */
interface Layer<Mark> {
  readonly covers: (at: Place) => boolean;
  /** The places on its painted edge, in the picture's own room, with its groups' transforms done. */
  readonly rim: readonly Place[];
  readonly shape: Shape<Mark>;
}

/** What a kind of shape covers: the places that bound it, and the test inside. */
interface Cover {
  readonly bound: readonly Place[];
  readonly covers: (at: Place) => boolean;
  /** The places on its painted edge before a stroke widens it: the bound of a straight-sided shape, or places round a round one. */
  readonly rim: readonly Place[];
}

/** How many places stand round a circle or an ellipse. */
const ROUND = 32;

/** The places round an ellipse. */
function roundOf(cx: number, cy: number, rx: number, ry: number) {
  return Arr.makeBy(ROUND, (i): Place => {
    const turn = (i / ROUND) * 2 * Math.PI;
    return [cx + rx * Math.cos(turn), cy + ry * Math.sin(turn)];
  });
}

/** The places a stroke of half width `grow` reaches round each place, so a turned stroke keeps its reach. */
function widened(places: readonly Place[], grow: number): readonly Place[] {
  return grow === 0
    ? places
    : Arr.flatMap(places, ([x, y]) => roundOf(x, y, grow, grow));
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
          rim: Arr.flatten(pieces),
        };
      }),
      Match.tag("polygon", ({ points }) => {
        const outline = placesOf(numbersOf(points));
        return {
          bound: outline,
          covers: (at: Place) =>
            (filled && inside(outline, at)) ||
            (stroked && touches([...outline, outline[0]], at, width)),
          rim: outline,
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
        rim: [
          ...corners(x, y, x + across, y + height),
          ...corners(x + across, y, x, y + height),
        ],
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
        rim: roundOf(cx, cy, r, r),
      })),
      Match.tag("ellipse", ({ cx, cy, rx, ry }) => ({
        bound: corners(cx - rx, cy - ry, cx + rx, cy + ry),
        covers: (at: Place) =>
          filled && ((at[0] - cx) / rx) ** 2 + ((at[1] - cy) / ry) ** 2 <= 1,
        rim: roundOf(cx, cy, rx, ry),
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
        rim: Arr.map(widened(cover.rim, grow), (at) =>
          Arr.reduceRight(calls, at, apply)
        ),
        shape,
      },
    ];
  });
}

/** The shapes that leave ink, without one, or a group, that a fade has made clear. */
function inked<Mark>(shapes: readonly Shape<Mark>[]): readonly Shape<Mark>[] {
  return Arr.flatMap(shapes, (shape): readonly Shape<Mark>[] => {
    if (shape.opacity === 0) {
      return [];
    }
    return shape._tag === "g"
      ? [{ ...shape, children: inked(shape.children) }]
      : [shape];
  });
}

/** A box as its left, top, right and bottom edges. */
export type Extent = readonly [
  left: number,
  top: number,
  right: number,
  bottom: number,
];

/**
 * The box that everything a picture paints lies in, strokes included, through
 * its groups and their transforms: what a window on the picture must hold for
 * nothing of it to be cut. A shape faded out to nothing paints nothing.
 */
export function extentOf<Mark>(shapes: readonly Shape<Mark>[]): Extent {
  const rim = Arr.flatMap(layersOf(inked(shapes), []), (layer) => layer.rim);
  const xs = Arr.map(rim, ([x]) => x);
  const ys = Arr.map(rim, ([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
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
