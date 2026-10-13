import { BASE, NINA, PAGE, PAPER, POP, WHITE } from "@repo/mascot/color";
import { circle, group, path, rect, type Shape } from "@repo/mascot/shape";
import { sparkle } from "@repo/mascot/sparkle";
import type { Mark } from "@repo/mascot/thing/mark";
import type { ThingName } from "@repo/mascot/thing/name";

/** The iced coffee: the cup, and the milk that floats in it. */
const LATTE = "#c9a27e";
const MILK = "#f4e6ce";

/** The sticky note, and the folded corner of it. */
const STICKY = "#ffd88a";
const FOLD = "#e9b452";

/** A line of text on the note, which draws itself. */
const NOTE_LINE = {
  fill: "none",
  pathLength: 1,
  stroke: NINA.ink,
  strokeLinecap: "round",
  strokeOpacity: 0.6,
  strokeWidth: 3.5,
} as const;

/** What the product shows: a chat bubble, a right answer, a medal, a note, iced coffee, a shield, a stopwatch and a calendar. */
export const PRODUCT = {
  bubble: [
    path({
      d: "M12,12 H52 a9,9 0 0 1 9,9 V39 a9,9 0 0 1 -9,9 H27 L14,58 V48 H12 a9,9 0 0 1 -9,-9 V21 a9,9 0 0 1 9,-9 Z",
      fill: NINA.body,
    }),
    circle({ cx: 21, cy: 30, fill: WHITE, mark: { motion: "dot" }, r: 3.6 }),
    circle({
      cx: 32,
      cy: 30,
      fill: WHITE,
      mark: { delay: 0.16, motion: "dot" },
      r: 3.6,
    }),
    circle({
      cx: 43,
      cy: 30,
      fill: WHITE,
      mark: { delay: 0.32, motion: "dot" },
      r: 3.6,
    }),
  ],
  calendar: [
    path({
      d: "M22,6 V16 M42,6 V16",
      stroke: BASE,
      strokeLinecap: "round",
      strokeWidth: 4.5,
    }),
    rect({ fill: PAPER, height: 46, rx: 8, width: 46, x: 9, y: 11 }),
    path({
      d: "M9,25 V19 a8,8 0 0 1 8,-8 H47 a8,8 0 0 1 8,8 V25 Z",
      fill: POP.red,
    }),
    path({
      d: "M21,40 l8,8 l14,-15",
      fill: "none",
      mark: { motion: "draw" },
      pathLength: 1,
      stroke: POP.green,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 5.5,
    }),
  ],
  check: [
    circle({ cx: 32, cy: 32, fill: POP.green, r: 25 }),
    path({
      d: "M20,33 l9,9 l16,-18",
      fill: "none",
      mark: { motion: "draw" },
      pathLength: 1,
      stroke: WHITE,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 6,
    }),
  ],
  coffee: [
    path({
      d: "M35,21 L41,3",
      stroke: POP.red,
      strokeLinecap: "round",
      strokeWidth: 4,
    }),
    path({
      d: "M14,22 H50 L46.4,56 a4,4 0 0 1 -4,3.6 H21.6 a4,4 0 0 1 -4,-3.6 Z",
      fill: LATTE,
    }),
    path({ d: "M15.4,34 H48.6 L47.5,45 H16.5 Z", fill: MILK }),
    rect({ fill: BASE, height: 8, rx: 4, width: 44, x: 10, y: 17 }),
  ],
  medal: [
    path({ d: "M17,3 H28 L37,25 H26 Z", fill: POP.red }),
    path({ d: "M47,3 H36 L27,25 H38 Z", fill: POP.blue }),
    group(
      [
        circle({ cx: 32, cy: 41, fill: POP.yellow, r: 19 }),
        circle({
          cx: 32,
          cy: 41,
          fill: "none",
          r: 13.5,
          stroke: WHITE,
          strokeOpacity: 0.55,
          strokeWidth: 2.5,
        }),
        sparkle(32, 41, 8, WHITE),
      ],
      { mark: { motion: "sway" } }
    ),
  ],
  note: [
    group(
      [
        path({ d: "M11,7 H42 L53,18 V57 H11 Z", fill: STICKY }),
        path({ d: "M42,7 V18 H53 Z", fill: FOLD }),
        path({ ...NOTE_LINE, d: "M19,28 H45", mark: { motion: "draw" } }),
        path({
          ...NOTE_LINE,
          d: "M19,37 H45",
          mark: { delay: 0.35, motion: "draw" },
        }),
        path({
          ...NOTE_LINE,
          d: "M19,46 H36",
          mark: { delay: 0.7, motion: "draw" },
        }),
      ],
      { transform: "rotate(6 32 32)" }
    ),
  ],
  shield: [
    path({
      d: "M32,5 L55,13 V30 C55,44 45,53 32,59 C19,53 9,44 9,30 V13 Z",
      fill: NINA.body,
    }),
    path({
      d: "M21,31 l8,8 l14,-16",
      fill: "none",
      mark: { motion: "draw" },
      pathLength: 1,
      stroke: WHITE,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 6,
    }),
  ],
  stopwatch: [
    rect({ fill: BASE, height: 9, rx: 2.5, width: 10, x: 27, y: 3 }),
    rect({
      fill: BASE,
      height: 7,
      rx: 2.5,
      transform: "rotate(42 49.5 14.5)",
      width: 9,
      x: 45,
      y: 11,
    }),
    circle({ cx: 32, cy: 36, fill: POP.blue, r: 23 }),
    circle({ cx: 32, cy: 36, fill: PAGE, r: 16.5 }),
    path({
      d: "M32,36 V24.5",
      mark: { motion: "tick" },
      stroke: POP.red,
      strokeLinecap: "round",
      strokeWidth: 3.6,
    }),
    circle({ cx: 32, cy: 36, fill: NINA.ink, r: 3 }),
  ],
} as const satisfies Partial<Record<ThingName, readonly Shape<Mark>[]>>;
