import { NINA } from "@repo/mascot/color";
import { ink, line } from "@repo/mascot/nina/ink";
import { EYE, type Mark } from "@repo/mascot/nina/mark";
import { at } from "@repo/mascot/nina/point";
import { tenth } from "@repo/mascot/round";
import { circle, ellipse, path, type Shape } from "@repo/mascot/shape";
import { Schema } from "effect";

/** The ways one of her eyes is drawn. */
export const EyeSchema = Schema.Literals([
  "arc",
  "aside",
  "big",
  "brow",
  "dot",
  "set",
  "shut",
  "small",
  "tight",
  "up",
  "worried",
]);

/** An open eye: it blinks. */
function open(cx: number, cy: number, rx: number, ry: number) {
  return ellipse({
    cx: tenth(cx),
    cy: tenth(cy),
    fill: NINA.ink,
    mark: EYE,
    rx,
    ry,
  });
}

/** A curve of ink from one side of the eye to the other, bending through `bow`. */
function arc(x: number, y: number, rise: number, bow: number) {
  return ink(
    `M${at(x - 7, y + rise)} Q${at(x, y + bow)} ${at(x + 7, y + rise)}`
  );
}

/** An eye at x, y. `side` is -1 for her left eye and 1 for her right. */
export const EYES = {
  arc: (x, y) => [arc(x, y, 3, -8)],
  // Glancing aside and down, the way shy people look.
  aside: (x, y) => [open(x - 3, y + 3, 5.6, 6.8)],
  big: (x, y) => [
    open(x, y, 8.6, 10.4),
    circle({
      cx: tenth(x - 2.6),
      cy: tenth(y - 3.6),
      fill: NINA.face,
      r: 2.6,
    }),
  ],
  // Asking: the eye under one raised brow.
  brow: (x, y) => [
    open(x, y - 1, 6.6, 8),
    ink(`M${at(x - 9, y - 17)} Q${at(x, y - 23)} ${at(x + 9, y - 17)}`, 4),
  ],
  dot: (x, y) => [open(x, y, 6.6, 8)],
  // Set on something: the eye under a lid that slopes down toward the middle of her face.
  set: (x, y, side) => [
    open(x, y + 1, 6.6, 7.6),
    path({
      d: `M${at(x + side * 11, y - 12)} L${at(x - side * 11, y - 3)} L${at(x - side * 11, y - 12)} Z`,
      fill: NINA.face,
    }),
    ink(line([x + side * 10, y - 10], [x - side * 10, y - 3]), 4.5),
  ],
  shut: (x, y) => [arc(x, y, -1, 7)],
  small: (x, y) => [open(x, y + 1, 5, 6)],
  // Squeezed shut with laughter.
  tight: (x, y, side) => [
    ink(line([x - side * 7, y - 6], [x + side * 5, y], [x - side * 7, y + 6])),
  ],
  // Looking up, the way people do when they think.
  up: (x, y) => [open(x - 2.5, y - 4, 6.6, 8)],
  // Worried: the eye under a brow that rises toward the middle of her face.
  worried: (x, y, side) => [
    open(x, y + 1, 6.2, 7.4),
    ink(line([x + side * 9, y - 13], [x - side * 6, y - 18]), 4),
  ],
} satisfies Record<
  typeof EyeSchema.Type,
  (x: number, y: number, side: number) => readonly Shape<Mark>[]
>;
