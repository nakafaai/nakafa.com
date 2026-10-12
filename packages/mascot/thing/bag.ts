import {
  BASE,
  BOARD,
  NINA,
  PAPER,
  POP,
  SOFT_PINK,
  WHITE,
} from "@repo/mascot/color";
import { circle, group, path, rect, type Shape } from "@repo/mascot/shape";
import { sparkle } from "@repo/mascot/sparkle";
import type { Mark } from "@repo/mascot/thing/mark";
import type { ThingName } from "@repo/mascot/thing/name";

/** The dough of the donut, under its icing. */
const DOUGH = "#e2b07a";

/** The band of the graduation cap, a darker blue than its board. */
const NAVY = "#1f5f8f";

/** The flap of the envelope, a deeper paper than its body. */
const FLAP = "#f0c36f";

/** What goes in the bag and around school: the backpack, a cap, a trophy, a letter and the rest of what a learner carries. */
export const BAG = {
  backpack: [
    path({
      d: "M22,16 a10,10 0 0 1 20,0",
      fill: "none",
      stroke: BASE,
      strokeLinecap: "round",
      strokeWidth: 5,
    }),
    rect({ fill: POP.orange, height: 45, rx: 13, width: 42, x: 11, y: 14 }),
    path({
      d: "M19,28 H45",
      stroke: NINA.ink,
      strokeLinecap: "round",
      strokeOpacity: 0.28,
      strokeWidth: 3.4,
    }),
    rect({ fill: PAPER, height: 17, rx: 6, width: 28, x: 18, y: 36 }),
    sparkle(32, 44.5, 5.5, POP.orange),
  ],
  cap: [
    path({ d: "M15,31 V45 c9,9 25,9 34,0 V31 L32,40 Z", fill: NAVY }),
    path({ d: "M32,10 L61,25 L32,40 L3,25 Z", fill: POP.blue }),
    group(
      [
        path({
          d: "M54,26 V43",
          fill: "none",
          stroke: POP.yellow,
          strokeLinecap: "round",
          strokeWidth: 3.2,
        }),
        circle({ cx: 54, cy: 46, fill: POP.yellow, r: 4 }),
      ],
      { mark: { motion: "sway" } }
    ),
  ],
  donut: [
    path({
      d: "M32,7 a25,25 0 1 0 0.01,0 Z M32,24 a8,8 0 1 1 -0.01,0 Z",
      fill: DOUGH,
      fillRule: "evenodd",
    }),
    path({
      d: "M32,12 c8,-2 18,6 20,15 c2,10 -5,22 -15,24 c-9,3 -22,-2 -25,-13 c-3,-10 4,-21 12,-24 c3,-1 5,-2 8,-2 Z M32,24 a8,8 0 1 1 -0.01,0 Z",
      fill: SOFT_PINK,
      fillRule: "evenodd",
    }),
    path({
      d: "M20,22 l4,2 M41,17 l1,4 M46,33 l4,-1 M22,41 l-3,3 M36,46 l4,1 M17,31 l-1,-3",
      fill: "none",
      stroke: WHITE,
      strokeLinecap: "round",
      strokeWidth: 3,
    }),
  ],
  flag: [
    path({
      d: "M15,7 V58",
      stroke: BOARD,
      strokeLinecap: "round",
      strokeWidth: 5,
    }),
    path({
      d: "M17.5,9 C28,3 37,16 52,9 V34 C37,41 28,28 17.5,34 Z",
      fill: POP.red,
      mark: { motion: "wave" },
    }),
  ],
  globe: [
    path({
      d: "M52,38 A22,22 0 0 1 15,43",
      fill: "none",
      stroke: BASE,
      strokeLinecap: "round",
      strokeWidth: 4.5,
    }),
    path({ d: "M32,50 V56", stroke: BASE, strokeWidth: 4.5 }),
    rect({ fill: BASE, height: 6, rx: 3, width: 22, x: 21, y: 54 }),
    circle({ cx: 32, cy: 27, fill: POP.blue, r: 20 }),
    path({
      d: "M21,15 c7,-5 13,0 11,6 c-2,5 -9,4 -10,10 c-6,-3 -7,-12 -1,-16 Z M38,26 c6,-1 10,4 8,10 c-5,5 -10,1 -8,-10 Z",
      fill: POP.green,
    }),
  ],
  headphones: [
    path({
      d: "M13,40 V32 a19,19 0 0 1 38,0 V40",
      fill: "none",
      stroke: BASE,
      strokeLinecap: "round",
      strokeWidth: 6,
    }),
    rect({ fill: POP.orange, height: 23, rx: 7, width: 15, x: 5, y: 34 }),
    rect({ fill: POP.orange, height: 23, rx: 7, width: 15, x: 44, y: 34 }),
  ],
  letter: [
    rect({ fill: PAPER, height: 40, rx: 7, width: 54, x: 5, y: 13 }),
    path({
      d: "M5,21 a8,8 0 0 1 8,-8 H51 a8,8 0 0 1 8,8 L32,39 Z",
      fill: FLAP,
    }),
    circle({ cx: 32, cy: 37.5, fill: POP.red, r: 6.5 }),
  ],
  plane: [
    group(
      [
        path({ d: "M5,30 L59,7 L39,57 L28,39 Z", fill: NINA.body }),
        path({ d: "M59,7 L28,39 L30,54 L37,44 Z", fill: POP.blue }),
      ],
      { mark: { motion: "glide" } }
    ),
  ],
  trophy: [
    path({
      d: "M18,14 C5,14 6,31 21,31 M46,14 C59,14 58,31 43,31",
      fill: "none",
      stroke: POP.yellow,
      strokeLinecap: "round",
      strokeWidth: 5,
    }),
    path({ d: "M17,8 H47 V23 a15,15 0 0 1 -30,0 Z", fill: POP.yellow }),
    rect({ fill: POP.yellow, height: 11, width: 8, x: 28, y: 36 }),
    rect({ fill: BOARD, height: 9, rx: 3.5, width: 28, x: 18, y: 46 }),
    sparkle(32, 21, 6.5, WHITE),
  ],
} as const satisfies Partial<Record<ThingName, readonly Shape<Mark>[]>>;
