import {
  BASE,
  BOARD,
  NINA,
  PAGE,
  POP,
  SOFT_PINK,
  TEXT,
  WHITE,
} from "@repo/mascot/color";
import { circle, group, path, rect, type Shape } from "@repo/mascot/shape";
import type { Mark } from "@repo/mascot/thing/mark";
import type { ThingName } from "@repo/mascot/thing/name";
import { Array as Arr } from "effect";

/** The cap of the highlighter, a paler pink than its body. */
const BLUSH = "#ffc2cd";

/** The keys of the calculator: three rows of three, the last one lit. */
const CALCULATOR_KEYS = Arr.makeBy(9, (key) =>
  circle({
    cx: 23 + (key % 3) * 9,
    cy: 33 + Math.floor(key / 3) * 8.5,
    fill: key === 8 ? POP.orange : WHITE,
    r: 3.1,
  })
);

/** The lines of the checklist: a tick and a line of text, three times. */
const BOARD_ROWS = Arr.flatMap(Arr.range(0, 2), (row) => {
  const y = 25 + row * 10;
  return [
    path({
      d: `M21,${y} l2.6,2.6 l4.6,-5`,
      fill: "none",
      stroke: POP.green,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 3,
    }),
    path({
      d: `M32,${y} H${row === 2 ? 39 : 43}`,
      stroke: NINA.ink,
      strokeLinecap: "round",
      strokeOpacity: 0.5,
      strokeWidth: 3.2,
    }),
  ];
});

/** What lies on a learner's desk: the board, the lamp, the calculator, and what they write, measure and rub out with. */
export const DESK = {
  board: [
    rect({ fill: BOARD, height: 51, rx: 7, width: 42, x: 11, y: 8 }),
    rect({ fill: PAGE, height: 39, rx: 3.5, width: 32, x: 16, y: 15 }),
    rect({ fill: BASE, height: 10, rx: 3.5, width: 18, x: 23, y: 3 }),
    ...BOARD_ROWS,
  ],
  bulb: [
    path({
      d: "M5,25 h6 M53,25 h6 M11,7 l4,4 M53,7 l-4,4",
      fill: "none",
      mark: { motion: "glint" },
      stroke: POP.yellow,
      strokeLinecap: "round",
      strokeWidth: 3.6,
    }),
    path({
      d: "M32,6 a19,19 0 0 1 11,34.5 V46 H21 V40.5 A19,19 0 0 1 32,6 Z",
      fill: POP.yellow,
    }),
    path({
      d: "M26,29 q6,8 12,0",
      fill: "none",
      stroke: WHITE,
      strokeLinecap: "round",
      strokeWidth: 3.2,
    }),
    rect({ fill: BASE, height: 6, rx: 2.5, width: 20, x: 22, y: 46 }),
    rect({ fill: BASE, height: 5.5, rx: 2.75, width: 12, x: 26, y: 53 }),
  ],
  calculator: [
    rect({ fill: POP.blue, height: 54, rx: 8, width: 38, x: 13, y: 5 }),
    rect({ fill: NINA.face, height: 13, rx: 3.5, width: 26, x: 19, y: 11 }),
    ...CALCULATOR_KEYS,
  ],
  clip: [
    group(
      [
        path({
          d: "M21,20 V45 a11,11 0 0 0 22,0 V15 a7.5,7.5 0 0 0 -15,0 V43 a4,4 0 0 0 8,0 V22",
          fill: "none",
          stroke: BASE,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          strokeWidth: 5.6,
        }),
      ],
      { transform: "rotate(28 32 32)" }
    ),
  ],
  eraser: [
    group(
      [
        rect({ fill: SOFT_PINK, height: 24, rx: 6, width: 50, x: 7, y: 20 }),
        path({
          d: "M26,20 H51 a6,6 0 0 1 6,6 V38 a6,6 0 0 1 -6,6 H26 Z",
          fill: POP.blue,
        }),
        rect({
          fill: WHITE,
          fillOpacity: 0.75,
          height: 4.5,
          rx: 2.25,
          width: 15,
          x: 33,
          y: 26,
        }),
      ],
      { transform: "rotate(-18 32 32)" }
    ),
  ],
  glasses: [
    path({
      d: "M9,29 L4,19 M55,29 L60,19 M29,33 q3,-5 6,0",
      fill: "none",
      stroke: TEXT,
      strokeLinecap: "round",
      strokeWidth: 4.5,
    }),
    circle({
      cx: 18.5,
      cy: 36,
      fill: NINA.face,
      r: 11.5,
      stroke: TEXT,
      strokeWidth: 5,
    }),
    circle({
      cx: 45.5,
      cy: 36,
      fill: NINA.face,
      r: 11.5,
      stroke: TEXT,
      strokeWidth: 5,
    }),
  ],
  highlighter: [
    path({
      d: "M8,55 H34",
      fill: "none",
      mark: { motion: "draw" },
      pathLength: 1,
      stroke: SOFT_PINK,
      strokeLinecap: "round",
      strokeOpacity: 0.6,
      strokeWidth: 9,
    }),
    group(
      [
        path({ d: "M-5,0 H5 L7,-10 H-7 Z", fill: BLUSH }),
        rect({ fill: SOFT_PINK, height: 30, rx: 4, width: 18, x: -9, y: -40 }),
        rect({ fill: BASE, height: 12, rx: 4, width: 18, x: -9, y: -50 }),
      ],
      { transform: "translate(38 50) rotate(38)" }
    ),
  ],
  hourglass: [
    path({
      d: "M18,12 H46 C46,26 36,28 36,32 C36,36 46,38 46,52 H18 C18,38 28,36 28,32 C28,28 18,26 18,12 Z",
      fill: NINA.face,
    }),
    path({
      d: "M23,20 H41 C39,26 34,28 32,30 C30,28 25,26 23,20 Z",
      fill: POP.yellow,
    }),
    path({
      d: "M32,31 V45",
      mark: { motion: "dot" },
      stroke: POP.yellow,
      strokeLinecap: "round",
      strokeWidth: 2.6,
    }),
    path({ d: "M21,52 C24,43 40,43 43,52 Z", fill: POP.yellow }),
    rect({ fill: BOARD, height: 8, rx: 4, width: 38, x: 13, y: 5 }),
    rect({ fill: BOARD, height: 8, rx: 4, width: 38, x: 13, y: 51 }),
  ],
  ruler: [
    group(
      [
        rect({ fill: POP.yellow, height: 18, rx: 4, width: 58, x: 3, y: 23 }),
        path({
          d: "M11,23 v8 M19,23 v5 M27,23 v8 M35,23 v5 M43,23 v8 M51,23 v5",
          fill: "none",
          stroke: NINA.ink,
          strokeLinecap: "round",
          strokeOpacity: 0.6,
          strokeWidth: 2.6,
        }),
      ],
      { transform: "rotate(24 32 32)" }
    ),
  ],
} as const satisfies Partial<Record<ThingName, readonly Shape<Mark>[]>>;
