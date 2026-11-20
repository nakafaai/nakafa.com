import { tenth } from "@repo/mascot/round";
import type { Shape } from "@repo/mascot/shape";
import {
  ellipse as drawEllipse,
  path as drawPath,
  group,
  polygon,
} from "@repo/mascot/shape";
import { Array as Arr, Match, Schema } from "effect";

/** The ink of every eye, mouth, and nose. */
export const INK = "#15294f";

/** The pale white that several animals share. */
export const PEARL = "#f6f4ef";

/** The pink of an inner ear, a tongue, or a nose that is not ink. */
export const PINK = "#f29bb2";

/** What an animal marks in its drawing: the open eyes, which can follow the pointer. */
export const Mark = Schema.Literal("eye");

/** One layer of an animal, or layers drawn together. */
export type Layer = Shape<typeof Mark.Type>;

/** What the eyes of an animal do: open, smiling, one winking, or asleep. */
export const Eyes = Schema.Literals(["open", "smile", "wink", "asleep"]);

/**
 * What an animal is drawn with: the colours of its palette, the ink, how its
 * eyes look, and how far its pose turns them to the side.
 */
const Kit = Schema.Struct({
  body: Schema.String,
  eyes: Eyes,
  ink: Schema.String,
  look: Schema.Finite,
  second: Schema.String,
});

/**
 * One animal: its palettes as [body, second] colour pairs, and how to draw it.
 * The body is the one colour that fills most of the animal; the second marks
 * the one or two places that name it, such as a muzzle, a mane, or a shell.
 */
export interface Design {
  readonly colors: readonly (readonly [string, string])[];
  readonly draw: (kit: typeof Kit.Type) => readonly Layer[];
}

/** The layers of an animal, back to front, with each group of layers laid flat. */
export function figure(...layers: readonly (Layer | readonly Layer[])[]) {
  return Arr.flatMap(layers, Arr.ensure);
}

/** Draws a layer once on each side of the centre line. The layer receives -1 or 1. */
export function both<A extends Layer>(
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
  return drawEllipse({
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
  return drawPath({ d, fill });
}

/** A path whose corners an outline of its own fill rounds by `width`. */
export function rounded(d: string, fill: string, width: number) {
  return drawPath({
    d,
    fill,
    stroke: fill,
    strokeLinejoin: "round",
    strokeWidth: width,
  });
}

/** A polygon from flat `x, y` pairs, its corners rounded by a stroke of `width`. */
export function blob(points: readonly number[], fill: string, width: number) {
  return polygon({
    fill,
    points: Arr.join(
      Arr.map(Arr.chunksOf(points, 2), ([x, y]) => `${tenth(x)},${tenth(y)}`),
      " "
    ),
    stroke: fill,
    strokeLinejoin: "round",
    strokeWidth: width,
  });
}

/** A stroke with round ends. */
export function line(d: string, color: string, width: number) {
  return drawPath({
    d,
    fill: "none",
    stroke: color,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: width,
  });
}

/** Layers drawn together at one opacity. */
export function faded(opacity: number, layers: readonly Layer[]) {
  return group(layers, { opacity });
}

/**
 * The head: an ellipse on the centre line. It is the largest shape of almost
 * every animal, so the face still reads when the avatar is as small as a line
 * of text.
 */
export function head(fill: string, rx: number, ry: number, cy: number) {
  return ellipse(100, cy, rx, ry, fill);
}

/** The shoulders, rising from the bottom edge, as wide as `half` either side. */
export function shoulders(fill: string, half: number, top = 146) {
  return path(
    `M${100 - half},200 C${100 - half},${top + 18} ${118 - half},${top} 100,${top} C${82 + half},${top} ${100 + half},${top + 18} ${100 + half},200 Z`,
    fill
  );
}

/** A pale patch on the chest, rising from the bottom edge up to `top`. */
export function chest(fill: string, half: number, top = 166) {
  return path(
    `M${100 - half},200 C${100 - half},${top + 12} ${108 - half},${top} 100,${top} C${92 + half},${top} ${100 + half},${top + 12} ${100 + half},200 Z`,
    fill
  );
}

/** The nose: a rounded triangle on the centre line, wide `wide` and deep `deep`. */
export function nose(y: number, wide: number, deep: number, ink: string) {
  return blob(
    [100 - wide, y - deep / 2, 100 + wide, y - deep / 2, 100, y + deep / 2],
    ink,
    Math.min(wide, deep) * 0.9
  );
}

/** A small closed smile, the same lens that Nina smiles with. */
export function smile(y: number, wide: number, deep: number, ink: string) {
  return rounded(
    `M${tenth(100 - wide)},${y} Q100,${tenth(y + deep * 0.5)} ${tenth(100 + wide)},${y} Q100,${tenth(y + deep * 1.6)} ${tenth(100 - wide)},${y} Z`,
    ink,
    2.4
  );
}

/** A mouth drawn as a line, from `x0` to `x1` through a dip of `deep`. */
export function grin(
  y: number,
  wide: number,
  deep: number,
  ink: string,
  width = 3.2
) {
  return line(
    `M${tenth(100 - wide)},${y} Q100,${tenth(y + deep * 2)} ${tenth(100 + wide)},${y}`,
    ink,
    width
  );
}

/** The w of a cat's or a rabbit's mouth under its nose. */
export function mew(y: number, wide: number, ink: string, width = 3.2) {
  const half = tenth(wide / 2);
  return line(
    `M${tenth(100 - wide)},${y} Q${tenth(100 - half)},${tenth(y + half + 1)} 100,${y - 1} Q${tenth(100 + half)},${tenth(y + half + 1)} ${tenth(100 + wide)},${y}`,
    ink,
    width
  );
}

/**
 * One eye: an open eye, a plain dot of ink that follows the pointer, a smiling
 * arc, or a sleeping arc. The arcs are as wide as the dot and as thick as it
 * needs to stay a line at the smallest avatar.
 */
export function eye(
  kind: typeof Eyes.Type,
  x: number,
  y: number,
  r: number,
  ink: string
) {
  const width = tenth(Math.max(3.4, r * 0.62));
  return Match.value(kind).pipe(
    Match.when("smile", () =>
      line(
        `M${tenth(x - r)},${tenth(y + r * 0.4)} Q${tenth(x)},${tenth(y - r * 1.2)} ${tenth(x + r)},${tenth(y + r * 0.4)}`,
        ink,
        width
      )
    ),
    Match.when("asleep", () =>
      line(
        `M${tenth(x - r)},${tenth(y - r * 0.2)} Q${tenth(x)},${tenth(y + r * 1.1)} ${tenth(x + r)},${tenth(y - r * 0.2)}`,
        ink,
        width
      )
    ),
    Match.orElse(() =>
      group(
        [
          drawEllipse({
            cx: tenth(x),
            cy: tenth(y),
            fill: ink,
            rx: tenth(r),
            ry: tenth(r * 1.2),
          }),
        ],
        { mark: Mark.literal }
      )
    )
  );
}

/** What one side does when the eyes wink: the left eye smiles, the right stays open. */
export function kindAt(eyes: typeof Eyes.Type, side: number) {
  return Match.value(eyes).pipe(
    Match.when("wink", () => (side < 0 ? "smile" : "open")),
    Match.orElse((kept) => kept)
  );
}

/** Both eyes, `dx` either side of the centre line, shifted by the way the pose looks. */
export function eyes(
  kit: typeof Kit.Type,
  dx: number,
  y: number,
  r = 7,
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
        : ellipse(
            100 + side * (dx - r * 0.06),
            y + r * 0.08,
            r * 0.56,
            r * 0.56,
            inner
          )
    )
  );
}

/**
 * Pointed ears on both sides, each with an inner ear: a rounded triangle whose
 * tip stands `tip` from the centre line at height `top`.
 */
export function pointEars(
  body: string,
  inner: string,
  tip = 54,
  top = 30,
  base = 64
) {
  return both((side) => [
    blob(
      [
        100 + side * 18,
        base,
        100 + side * tip,
        top,
        100 + side * 62,
        base + 30,
      ],
      body,
      14
    ),
    blob(
      [
        100 + side * 32,
        base + 6,
        100 + side * (tip - 2),
        top + 14,
        100 + side * 54,
        base + 22,
      ],
      inner,
      6
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
