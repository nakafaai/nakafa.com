import {
  BASE,
  NINA,
  PAGE,
  POP,
  SOFT_PINK,
  TEXT,
  WHITE,
} from "@repo/mascot/color";
import { circle, group, path, rect, type Shape } from "@repo/mascot/shape";
import { sparkle } from "@repo/mascot/sparkle";
import type { Mark } from "@repo/mascot/thing/mark";
import type { ThingName } from "@repo/mascot/thing/name";

/** The wood under the paint of a sharpened pencil. */
const WOOD = "#f3d9b1";

/** What Nina holds in her actions: her book and pencil, the padlock and its key, a magnifier and the balls she juggles. */
export const HELD = {
  balls: [
    // The dotted arc is the path they fly, as when she juggles them.
    path({
      d: "M15,40 Q33,-14 51,42",
      fill: "none",
      stroke: TEXT,
      strokeDasharray: "0.1 6",
      strokeLinecap: "round",
      strokeOpacity: 0.32,
      strokeWidth: 2.5,
    }),
    circle({ cx: 15, cy: 44, fill: POP.red, mark: { motion: "hop" }, r: 10 }),
    circle({
      cx: 34,
      cy: 26,
      fill: POP.yellow,
      mark: { delay: -0.45, motion: "hop" },
      r: 10,
    }),
    circle({
      cx: 51,
      cy: 46,
      fill: POP.green,
      mark: { delay: -0.9, motion: "hop" },
      r: 10,
    }),
  ],
  book: [
    group(
      [
        rect({ fill: POP.orange, height: 47, rx: 5, width: 38, x: 14, y: 9 }),
        rect({ fill: PAGE, height: 5, rx: 1.5, width: 29, x: 21, y: 48 }),
        rect({
          fill: NINA.ink,
          fillOpacity: 0.24,
          height: 47,
          rx: 3.5,
          width: 7,
          x: 14,
          y: 9,
        }),
        sparkle(36, 28, 8, PAGE),
      ],
      { transform: "rotate(-8 32 32)" }
    ),
  ],
  key: [
    group(
      [
        group(
          [
            circle({ cx: 19, cy: 32, r: 9.5 }),
            path({ d: "M29,32 H55 M44,32 V41 M54,32 V39" }),
          ],
          {
            fill: "none",
            stroke: POP.yellow,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: 7.5,
            transform: "rotate(-38 32 32)",
          }
        ),
      ],
      { mark: { motion: "sway" } }
    ),
  ],
  magnifier: [
    path({
      d: "M40,40 L54,54",
      stroke: POP.orange,
      strokeLinecap: "round",
      strokeWidth: 8,
    }),
    circle({
      cx: 27,
      cy: 27,
      fill: NINA.face,
      r: 17,
      stroke: TEXT,
      strokeWidth: 5,
    }),
    path({
      d: "M17,25 a10.5,10.5 0 0 1 8,-8",
      fill: "none",
      mark: { motion: "glint" },
      stroke: WHITE,
      strokeLinecap: "round",
      strokeWidth: 3.5,
    }),
  ],
  padlock: [
    path({
      d: "M21,31 V22 a11,11 0 0 1 22,0 V31",
      fill: "none",
      mark: { motion: "open" },
      stroke: BASE,
      strokeLinecap: "round",
      strokeWidth: 6,
    }),
    rect({ fill: POP.yellow, height: 29, rx: 8, width: 40, x: 12, y: 28 }),
    circle({ cx: 32, cy: 40, fill: NINA.ink, r: 4 }),
    path({
      d: "M32,40 V47",
      stroke: NINA.ink,
      strokeLinecap: "round",
      strokeWidth: 4,
    }),
  ],
  pencil: [
    path({
      d: "M7,54 q4,-8 8,0 t8,0 l6,-5",
      fill: "none",
      mark: { motion: "draw" },
      pathLength: 1,
      stroke: TEXT,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 3,
    }),
    group(
      [
        group(
          [
            path({ d: "M0,0 L5,-11 L-5,-11 Z", fill: WOOD }),
            path({ d: "M0,0 L1.9,-4.2 L-1.9,-4.2 Z", fill: TEXT }),
            rect({ fill: POP.yellow, height: 27, width: 10, x: -5, y: -38 }),
            rect({ fill: BASE, height: 4, width: 10, x: -5, y: -42 }),
            rect({
              fill: SOFT_PINK,
              height: 8,
              rx: 3,
              width: 10,
              x: -5,
              y: -50,
            }),
          ],
          { transform: "translate(31 47) rotate(32)" }
        ),
      ],
      { mark: { motion: "write" } }
    ),
  ],
} as const satisfies Partial<Record<ThingName, readonly Shape<Mark>[]>>;
