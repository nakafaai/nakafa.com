import { type Ink, stroke } from "@repo/mascot/medal/ink";
import { circle, path, rect, type Shape } from "@repo/mascot/shape";
import { sparkle } from "@repo/mascot/sparkle";
import { Array as Arr } from "effect";

/** A chip with its pins: informatics. */
export function chip(ink: Ink): readonly Shape[] {
  return [
    ...Arr.map([48, 60, 72], (at) =>
      stroke(`M${at},27 L${at},81 M33,${at - 6} L87,${at - 6}`, ink.light, 3.2)
    ),
    rect({ fill: ink.first, height: 40, rx: 8, width: 40, x: 40, y: 34 }),
    rect({ fill: ink.light, height: 20, rx: 4.6, width: 20, x: 50, y: 44 }),
    circle({ cx: 60, cy: 54, fill: ink.dark, r: 3.4 }),
  ];
}

/** A small net of nodes that thinks: AI and data science. */
export function nodes(ink: Ink): readonly Shape[] {
  return [
    path({
      d: "M39,40 L60,31 M39,40 L60,54 M39,68 L60,54 M39,68 L60,77 M60,31 L81,54 M60,54 L81,54 M60,77 L81,54 M39,40 L39,68",
      fill: "none",
      stroke: ink.light,
      strokeLinecap: "round",
      strokeOpacity: 0.55,
      strokeWidth: 2.2,
    }),
    circle({ cx: 39, cy: 40, fill: ink.second, r: 5.6 }),
    circle({ cx: 39, cy: 68, fill: ink.third, r: 5.6 }),
    circle({ cx: 60, cy: 31, fill: ink.light, r: 5 }),
    circle({ cx: 60, cy: 54, fill: ink.first, r: 6.6 }),
    circle({ cx: 60, cy: 77, fill: ink.light, r: 5 }),
    circle({ cx: 81, cy: 54, fill: ink.light, r: 8.4 }),
    sparkle(81, 54, 4.6, ink.first),
  ];
}

/** A game pad: game engineering. */
export function pad(ink: Ink): readonly Shape[] {
  return [
    path({
      d: "M44,38 L76,38 C84,38 89,47 89,58 C89,69 86,75 80,75 C74,75 73,67 68,67 L52,67 C47,67 46,75 40,75 C34,75 31,69 31,58 C31,47 36,38 44,38 Z",
      fill: ink.light,
    }),
    stroke("M41,53 L53,53 M47,47 L47,59", ink.dark, 3.8),
    circle({ cx: 69, cy: 57, fill: ink.first, r: 3.6 }),
    circle({ cx: 77, cy: 50, fill: ink.second, r: 3.6 }),
  ];
}

/** A terminal that waits for a command: computer science. */
export function terminal(ink: Ink): readonly Shape[] {
  return [
    rect({ fill: ink.light, height: 46, rx: 8, width: 54, x: 33, y: 31 }),
    path({
      d: "M33,39 C33,34.6 36.6,31 41,31 L79,31 C83.4,31 87,34.6 87,39 L87,43 L33,43 Z",
      fill: ink.first,
    }),
    ...Arr.map([41, 47.4, 53.8], (cx) =>
      circle({ cx, cy: 37, fill: ink.third, r: 1.9 })
    ),
    stroke("M42,52 L50,58.5 L42,65", ink.dark, 3.4),
    stroke("M56,66 L70,66", ink.second, 3.4),
  ];
}

/** A heart and its beat: electro-medical technology. */
export function pulse(ink: Ink): readonly Shape[] {
  return [
    path({
      d: "M60,80 C43,67 35,58 35,46 C35,37 42,31 49.6,31 C54.4,31 58,33.6 60,38 C62,33.6 65.6,31 70.4,31 C78,31 85,37 85,46 C85,58 77,67 60,80 Z",
      fill: ink.first,
    }),
    stroke(
      "M40,54 L50,54 L54.6,44 L60,65 L65,50 L67.6,54 L80,54",
      ink.light,
      3.2
    ),
  ];
}

/** A gear round a line of code: informatics engineering. */
export function gear(ink: Ink): readonly Shape[] {
  return [
    ...Arr.map([0, 45, 90, 135, 180, 225, 270, 315], (turn) =>
      rect({
        fill: ink.light,
        height: 12,
        rx: 2.6,
        transform: `rotate(${turn} 60 54)`,
        width: 11,
        x: 54.5,
        y: 27,
      })
    ),
    circle({ cx: 60, cy: 54, fill: ink.light, r: 21 }),
    circle({ cx: 60, cy: 54, fill: ink.second, r: 14 }),
    stroke(
      "M56.6,48.6 L51.4,54 L56.6,59.4 M63.4,48.6 L68.6,54 L63.4,59.4",
      ink.dark,
      2.8
    ),
  ];
}
