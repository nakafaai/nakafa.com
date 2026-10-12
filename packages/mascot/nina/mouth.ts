import { NINA, SOFT_PINK } from "@repo/mascot/color";
import { ink, line } from "@repo/mascot/nina/ink";
import type { Mark } from "@repo/mascot/nina/mark";
import { at } from "@repo/mascot/nina/point";
import { tenth } from "@repo/mascot/round";
import { ellipse, path, type Shape } from "@repo/mascot/shape";
import { Schema } from "effect";

/** The ways her mouth is drawn. */
export const MouthSchema = Schema.Literals([
  "cat",
  "flat",
  "frown",
  "gasp",
  "grin",
  "hm",
  "laugh",
  "oh",
  "small",
  "smile",
  "smirk",
  "tongue",
  "wave",
]);

/** A mouth that opens: `wide` across, `deep` down. */
function smile(x: number, y: number, wide: number, deep: number) {
  return path({
    d: `M${at(x - wide, y)} Q${at(x, y + 14)} ${at(x + wide, y + 1)} Q${at(x, y + deep)} ${at(x - wide, y)} Z`,
    fill: NINA.ink,
    stroke: NINA.ink,
    strokeLinejoin: "round",
    strokeWidth: 3,
  });
}

/** The mouth, with its middle at x, y. */
export const MOUTHS = {
  // The mouth of a pleased cat.
  cat: (x, y) => [
    ink(
      `M${at(x - 15, y + 2)} Q${at(x - 13, y + 12)} ${at(x - 6, y + 12)} Q${at(x, y + 12)} ${at(x, y + 4)} Q${at(x, y + 12)} ${at(x + 6, y + 12)} Q${at(x + 13, y + 12)} ${at(x + 15, y + 2)}`
    ),
  ],
  flat: (x, y) => [ink(line([x - 7, y + 6], [x + 7, y + 6]))],
  frown: (x, y) => [
    ink(`M${at(x - 14, y + 13)} Q${at(x, y)} ${at(x + 14, y + 13)}`),
  ],
  gasp: (x, y) => [
    ellipse({ cx: tenth(x), cy: tenth(y + 9), fill: NINA.ink, rx: 8, ry: 10 }),
  ],
  grin: (x, y) => [smile(x, y, 26, 32)],
  hm: (x, y) => [ink(line([x - 2, y + 7], [x + 12, y + 5]))],
  laugh: (x, y) => [
    path({
      d: `M${at(x - 20, y)} Q${at(x, y + 5)} ${at(x + 20, y)} Q${at(x + 16, y + 26)} ${at(x, y + 26)} Q${at(x - 16, y + 26)} ${at(x - 20, y)} Z`,
      fill: NINA.ink,
      stroke: NINA.ink,
      strokeLinejoin: "round",
      strokeWidth: 3,
    }),
    ellipse({
      cx: tenth(x),
      cy: tenth(y + 20),
      fill: SOFT_PINK,
      rx: 9,
      ry: 5,
    }),
  ],
  oh: (x, y) => [
    ellipse({ cx: tenth(x), cy: tenth(y + 6), fill: NINA.ink, rx: 5, ry: 6 }),
  ],
  small: (x, y) => [
    ink(`M${at(x - 8, y + 4)} Q${at(x, y + 11)} ${at(x + 8, y + 4)}`),
  ],
  smile: (x, y) => [smile(x, y, 21, 24)],
  smirk: (x, y) => [
    ink(`M${at(x - 14, y + 3)} Q${at(x + 4, y + 15)} ${at(x + 20, y - 1)}`),
  ],
  // A pressed mouth with the tip of her tongue out at one corner.
  tongue: (x, y) => [
    ellipse({
      cx: tenth(x + 9),
      cy: tenth(y + 10),
      fill: SOFT_PINK,
      rx: 5,
      ry: 6,
    }),
    ink(line([x - 10, y + 6], [x + 10, y + 6])),
  ],
  wave: (x, y) => [
    ink(
      `M${at(x - 15, y + 6)} Q${at(x - 7.5, y)} ${at(x, y + 6)} Q${at(x + 7.5, y + 12)} ${at(x + 15, y + 6)}`
    ),
  ],
} satisfies Record<
  typeof MouthSchema.Type,
  (x: number, y: number) => readonly Shape<Mark>[]
>;
