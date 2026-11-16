import { type Ink, stroke } from "@repo/mascot/medal/ink";
import {
  circle,
  ellipse,
  group,
  path,
  rect,
  type Shape,
} from "@repo/mascot/shape";
import { sparkle } from "@repo/mascot/sparkle";
import { Array as Arr } from "effect";

/** A compass: the days a learner came to learn. */
export function compass(ink: Ink): readonly Shape[] {
  return [
    circle({ cx: 60, cy: 54, fill: ink.light, r: 25 }),
    circle({
      cx: 60,
      cy: 54,
      fill: "none",
      r: 19,
      stroke: ink.dark,
      strokeOpacity: 0.25,
      strokeWidth: 2,
    }),
    ...Arr.map([0, 90, 180, 270], (turn) =>
      rect({
        fill: ink.dark,
        height: 5,
        rx: 1,
        transform: `rotate(${turn} 60 54)`,
        width: 2.4,
        x: 58.8,
        y: 31,
      })
    ),
    group(
      [
        path({ d: "M60,34 L67,54 L53,54 Z", fill: ink.first }),
        path({ d: "M60,74 L67,54 L53,54 Z", fill: ink.second }),
      ],
      { transform: "rotate(32 60 54)" }
    ),
    circle({ cx: 60, cy: 54, fill: ink.dark, r: 3.4 }),
  ];
}

/** Two crossed pencils under a star: the try-out sets a learner finished. */
export function pencils(ink: Ink): readonly Shape[] {
  const pencil = (turn: number, body: string) =>
    group(
      [
        rect({ fill: body, height: 34, rx: 2, width: 10, x: 55, y: 34 }),
        rect({ fill: ink.third, height: 7, rx: 2, width: 10, x: 55, y: 29 }),
        path({ d: "M55,68 L65,68 L60,79 Z", fill: ink.light }),
        path({ d: "M58,74.6 L62,74.6 L60,79 Z", fill: ink.dark }),
      ],
      { transform: `rotate(${turn} 60 56)` }
    );
  return [
    pencil(38, ink.first),
    pencil(-38, ink.second),
    sparkle(60, 31, 9, ink.light),
  ];
}

/** An open book with a bookmark: the lessons a learner read to the end. */
export function book(ink: Ink): readonly Shape[] {
  return [
    path({
      d: "M60,40 C52,33 42,33 33,37 L33,75 C42,71 52,71 60,78 Z",
      fill: ink.light,
    }),
    path({
      d: "M60,40 C68,33 78,33 87,37 L87,75 C78,71 68,71 60,78 Z",
      fill: ink.light,
    }),
    path({ d: "M71,34.4 L79,34.2 L79,52 L75,48 L71,52 Z", fill: ink.third }),
    stroke("M60,41 L60,77", ink.dark, 2.4),
    stroke(
      "M39,46 C45,44 50,45 54,48 M39,55 C45,53 50,54 54,57 M39,64 C45,62 50,63 54,66",
      ink.first,
      2.6
    ),
    stroke(
      "M66,57 C70,54 75,53 81,55 M66,66 C70,63 75,62 81,64",
      ink.second,
      2.6
    ),
  ];
}

/** A sheet of answers ticked off: the try-out sections a learner closed. */
export function sheet(ink: Ink): readonly Shape[] {
  const row = (y: number, fill: string) => [
    circle({ cx: 49.5, cy: y, fill, r: 5.2 }),
    stroke(`M47.2,${y} L49,${y + 1.9} L52,${y - 1.8}`, ink.light, 1.9),
    stroke(`M59,${y} L72,${y}`, ink.dark, 3),
  ];
  return [
    rect({ fill: ink.light, height: 54, rx: 7, width: 40, x: 40, y: 27 }),
    ...row(39.5, ink.first),
    ...row(54, ink.second),
    ...row(68.5, ink.third),
  ];
}

/** A flame with a bright heart: the longest run of days in a row. */
export function flame(ink: Ink): readonly Shape[] {
  return [
    path({
      d: "M61,26 C66,38 81,45 81,61 C81,73 72,81 60,81 C48,81 39,73 39,61 C39,53 43,47 47,42 C49,48 52,51 56,51 C54,42 56,33 61,26 Z",
      fill: ink.first,
    }),
    path({
      d: "M61,49 C64,56 71,60 71,68 C71,75 66,79 60,79 C54,79 49,75 49,68 C49,63 52,60 54,57 C55,60 57,61 59,61 C58.4,57 59.4,53 61,49 Z",
      fill: ink.second,
    }),
    ellipse({ cx: 60, cy: 72, fill: ink.light, rx: 4.4, ry: 5.2 }),
  ];
}
