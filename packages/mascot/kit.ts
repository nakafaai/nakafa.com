import {
  Ellipse,
  Eye,
  Fade,
  Line,
  type Part,
  Path,
  Polygon,
  type Solid,
} from "@repo/mascot/shape";
import { Array as Arr, Match, Number as Num, Schema } from "effect";

/** The ink of every eye, mouth, and nose. */
export const INK = "#15294f";

/** The white that several animals share. */
export const WHITE = "#f6f4ef";

/** What the eyes of an animal do: open, smiling, one winking, or asleep. */
export const Eyes = Schema.Literals(["titik", "senyum", "kedip", "tidur"]);

/**
 * What an animal is drawn with: the colours of its palette, the ink, how its
 * eyes look, and how far its pose turns them to the side.
 */
export const Kit = Schema.Struct({
  body: Schema.String,
  eyes: Eyes,
  ink: Schema.String,
  look: Schema.Finite,
  second: Schema.String,
});

/** One animal: its palettes as [body, second] colour pairs, and how to draw it. */
export interface Design {
  readonly colors: readonly (readonly [string, string])[];
  readonly draw: (kit: typeof Kit.Type) => readonly (typeof Part.Type)[];
}

const tenth = Num.round(1);

/** The layers of an animal, back to front, with each group of layers laid flat. */
export function figure(
  ...layers: readonly (typeof Part.Type | readonly (typeof Part.Type)[])[]
) {
  return Arr.flatMap(layers, Arr.ensure);
}

/** Draws a layer once on each side of the centre line. The layer receives -1 or 1. */
export function both<A extends typeof Part.Type>(
  layer: (side: number) => A | readonly A[]
) {
  return Arr.flatMap([-1, 1], (side) => Arr.ensure(layer(side)));
}

/** An ellipse, turned by `turn` degrees about its own centre. */
export function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: string,
  turn = 0
) {
  return Ellipse.make({
    cx: tenth(cx),
    cy: tenth(cy),
    fill,
    rx: tenth(rx),
    ry: tenth(ry),
    ...(turn === 0
      ? {}
      : { transform: `rotate(${turn} ${tenth(cx)} ${tenth(cy)})` }),
  });
}

/** A flat path. */
export function path(d: string, fill: string) {
  return Path.make({ d, fill });
}

/** A path whose corners an outline rounds. */
export function outlined(
  d: string,
  fill: string,
  color: string,
  width: number
) {
  return Path.make({ d, fill, outline: { color, width } });
}

/** A polygon from flat `x, y` pairs, its corners rounded by a stroke of `width`. */
export function blob(points: readonly number[], fill: string, width: number) {
  return Polygon.make({
    fill,
    points: Arr.join(
      Arr.map(Arr.chunksOf(points, 2), ([x, y]) => `${tenth(x)},${tenth(y)}`),
      " "
    ),
    rounding: width,
  });
}

/** A stroke with round ends. */
export function line(d: string, color: string, width: number) {
  return Line.make({ color, d, width });
}

/** Shapes drawn together at one opacity. */
export function faded(opacity: number, shapes: readonly (typeof Solid.Type)[]) {
  return Fade.make({ opacity, shapes });
}

/** The head: an ellipse on the centre line. */
export function head(fill: string, rx = 60, ry = 52, cy = 98) {
  return ellipse(100, cy, rx, ry, fill);
}

/** The torso, rising from the bottom edge to the shoulders. */
export function torso(fill: string, half = 56) {
  return path(
    `M${100 - half},200 C${98 - half},170 ${108 - half},142 ${120 - half},126 L${80 + half},126 C${92 + half},142 ${102 + half},170 ${100 + half},200 Z`,
    fill
  );
}

/** The belly: a pale patch from the bottom edge up to `top`. */
export function belly(fill: string, half = 30, top = 148) {
  return path(
    `M${100 - half},200 C${100 - half},178 ${108 - half},${top + 4} 100,${top} C${92 + half},${top + 4} ${100 + half},178 ${100 + half},200 Z`,
    fill
  );
}

/** The nose: a small ellipse on the centre line. */
export function nose(y: number, rx: number, ry: number, ink: string) {
  return ellipse(100, y, rx, ry, ink);
}

/** A mouth: a closed lens, drawn with an outline of its own colour. */
export function smile(y: number, wide: number, deep: number, ink: string) {
  return outlined(
    `M${100 - wide},${y} Q100,${tenth(y + deep * 0.62)} ${100 + wide},${y} Q100,${tenth(y + deep * 1.5)} ${100 - wide},${y} Z`,
    ink,
    ink,
    2.6
  );
}

/** One eye: an open eye that follows the pointer, a smiling arc, or a sleeping arc. */
export function eye(
  kind: typeof Eyes.Type,
  x: number,
  y: number,
  r: number,
  ink: string
) {
  return Match.value(kind).pipe(
    Match.when("senyum", () =>
      line(
        `M${tenth(x - r)},${tenth(y + 2)} Q${tenth(x)},${tenth(y - r - 2)} ${tenth(x + r)},${tenth(y + 2)}`,
        ink,
        4.6
      )
    ),
    Match.when("tidur", () =>
      line(
        `M${tenth(x - r)},${tenth(y - 1)} Q${tenth(x)},${tenth(y + r)} ${tenth(x + r)},${tenth(y - 1)}`,
        ink,
        4.6
      )
    ),
    Match.orElse(() =>
      Eye.make({
        cx: tenth(x),
        cy: tenth(y),
        fill: ink,
        rx: tenth(r),
        ry: tenth(r * 1.22),
      })
    )
  );
}

/** What one side does when the eyes wink: the left eye smiles, the right stays open. */
export function kindAt(eyes: typeof Eyes.Type, side: number) {
  return Match.value(eyes).pipe(
    Match.when("kedip", () => (side < 0 ? "senyum" : "titik")),
    Match.orElse((open) => open)
  );
}

/** Both eyes, `dx` either side of the centre line, shifted by the way the pose looks. */
export function eyes(
  kit: typeof Kit.Type,
  dx: number,
  y: number,
  r = 6.4,
  ink = kit.ink
) {
  return both((side) =>
    eye(kindAt(kit.eyes, side), 100 + side * dx + kit.look, y, r, ink)
  );
}

/** Round ears on both sides, each with an inner ear when `inner` is given. */
export function roundEars(
  body: string,
  inner: string | null,
  dx: number,
  y: number,
  r: number
) {
  return both((side) =>
    figure(
      ellipse(100 + side * dx, y, r, r, body),
      inner === null
        ? []
        : ellipse(100 + side * dx, y + 1, r * 0.52, r * 0.52, inner)
    )
  );
}

/** Pointed ears on both sides, each with an inner ear. */
export function pointEars(body: string, inner: string) {
  return both((side) => [
    blob(
      [100 + side * 54, 82, 100 + side * 52, 36, 100 + side * 20, 58],
      body,
      12
    ),
    blob(
      [100 + side * 48, 70, 100 + side * 47, 50, 100 + side * 34, 60],
      inner,
      5
    ),
  ]);
}

/** A ring of short spikes around the top of a head, between two angles in degrees. */
export function spikes(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  from: number,
  to: number,
  count: number,
  fill: string,
  width = 4
) {
  return Arr.makeBy(count, (index) => {
    const angle =
      ((from + ((to - from) * index) / (count - 1)) * Math.PI) / 180;
    const spread = (((to - from) / (count - 1)) * 0.5 * Math.PI) / 180;
    return blob(
      [
        cx + Math.cos(angle - spread) * inner,
        cy + Math.sin(angle - spread) * inner,
        cx + Math.cos(angle) * outer,
        cy + Math.sin(angle) * outer,
        cx + Math.cos(angle + spread) * inner,
        cy + Math.sin(angle + spread) * inner,
      ],
      fill,
      width
    );
  });
}
