import { type Ink, stroke } from "@repo/mascot/medal/ink";
import { circle, ellipse, path, rect, type Shape } from "@repo/mascot/shape";
import { Array as Arr } from "effect";

/** Four tiles of the four operations: mathematics. */
export function tiles(ink: Ink): readonly Shape[] {
  const tile = (x: number, y: number, fill: string) =>
    rect({ fill, height: 21, rx: 5, width: 21, x, y });
  return [
    tile(37, 31, ink.light),
    tile(62, 31, ink.first),
    tile(37, 56, ink.second),
    tile(62, 56, ink.light),
    stroke("M42,41.5 L53,41.5 M47.5,36 L47.5,47", ink.dark, 3.2),
    stroke("M67,41.5 L78,41.5", ink.dark, 3.2),
    stroke("M43.5,62.5 L51.5,70.5 M51.5,62.5 L43.5,70.5", ink.dark, 3.2),
    stroke("M67,66.5 L78,66.5", ink.dark, 3.2),
    circle({ cx: 72.5, cy: 61.4, fill: ink.dark, r: 1.9 }),
    circle({ cx: 72.5, cy: 71.6, fill: ink.dark, r: 1.9 }),
  ];
}

/** An atom, its electrons on three orbits: physics. */
export function atom(ink: Ink): readonly Shape[] {
  return [
    ...Arr.map([0, 60, 120], (turn) =>
      ellipse({
        cx: 60,
        cy: 54,
        fill: "none",
        rx: 27,
        ry: 10.5,
        stroke: ink.light,
        strokeWidth: 3,
        transform: `rotate(${turn} 60 54)`,
      })
    ),
    circle({ cx: 60, cy: 54, fill: ink.first, r: 7.5 }),
    circle({ cx: 86, cy: 51, fill: ink.second, r: 4.4 }),
    circle({ cx: 46, cy: 32, fill: ink.third, r: 4.4 }),
    circle({ cx: 49, cy: 78, fill: ink.second, r: 4.4 }),
  ];
}

/** A flask that bubbles: chemistry. */
export function flask(ink: Ink): readonly Shape[] {
  return [
    path({
      d: "M53,30 L67,30 L67,45 L82,72 C84,76 81,80 77,80 L43,80 C39,80 36,76 38,72 L53,45 Z",
      fill: ink.light,
    }),
    path({
      d: "M46.6,62 L73.4,62 L79,72 C80,74.6 78.4,76.6 76,76.6 L44,76.6 C41.6,76.6 40,74.6 41,72 Z",
      fill: ink.first,
    }),
    rect({ fill: ink.dark, height: 5, rx: 2.5, width: 20, x: 50, y: 27 }),
    circle({ cx: 55, cy: 69, fill: ink.light, r: 2.6 }),
    circle({ cx: 64, cy: 66, fill: ink.light, r: 1.9 }),
    circle({ cx: 60, cy: 53, fill: ink.second, r: 2.8 }),
    circle({ cx: 66, cy: 41, fill: ink.third, r: 2.2 }),
  ];
}

/** A sprout with two leaves: biology. */
export function sprout(ink: Ink): readonly Shape[] {
  return [
    path({ d: "M40,80 C40,70 80,70 80,80 Z", fill: ink.dark }),
    stroke("M60,74 C60,62 60,52 60,42", ink.first, 4),
    path({
      d: "M60,56 C44,58 36,48 36,36 C50,34 60,42 60,56 Z",
      fill: ink.first,
    }),
    path({
      d: "M60,48 C76,50 84,40 84,28 C70,26 60,34 60,48 Z",
      fill: ink.second,
    }),
    stroke("M41,40 C48,44 54,49 59,54", ink.light, 1.8),
    stroke("M79,32 C72,36 66,41 61,46", ink.light, 1.8),
    circle({ cx: 71, cy: 76, fill: ink.third, r: 3 }),
  ];
}

/** A globe with its lands and its lines: geography. */
export function globe(ink: Ink): readonly Shape[] {
  return [
    circle({ cx: 60, cy: 54, fill: ink.first, r: 26 }),
    path({
      d: "M45,34 C51,30 59,33 60,39 C61,45 54,47 52,53 C50,59 44,58 40,52 C37,46 40,38 45,34 Z",
      fill: ink.second,
    }),
    path({
      d: "M67,50 C73,47 81,52 81,59 C81,67 75,74 69,72 C64,70 63,56 67,50 Z",
      fill: ink.second,
    }),
    path({
      d: "M50,70 C54,67 59,69 59,73 C58,77 53,78 50,76 Z",
      fill: ink.second,
    }),
    ellipse({
      cx: 60,
      cy: 54,
      fill: "none",
      rx: 11,
      ry: 26,
      stroke: ink.light,
      strokeOpacity: 0.6,
      strokeWidth: 1.8,
    }),
    path({
      d: "M34,54 L86,54",
      fill: "none",
      stroke: ink.light,
      strokeOpacity: 0.6,
      strokeWidth: 1.8,
    }),
  ];
}

/** A folded map with a pin on it: geospatial. */
export function pin(ink: Ink): readonly Shape[] {
  return [
    path({
      d: "M33,46 L50,40 L70,46 L87,40 L87,75 L70,81 L50,75 L33,81 Z",
      fill: ink.light,
    }),
    path({ d: "M50,40 L70,46 L70,81 L50,75 Z", fill: ink.second }),
    ...Arr.map([0, 1, 2, 3], (step) =>
      circle({
        cx: 39 + step * 5.4,
        cy: 73 - step * 3.4,
        fill: ink.first,
        r: 1.7,
      })
    ),
    path({
      d: "M66,26 C73.7,26 80,32 80,39.6 C80,49 66,61 66,61 C66,61 52,49 52,39.6 C52,32 58.3,26 66,26 Z",
      fill: ink.third,
    }),
    circle({ cx: 66, cy: 39.4, fill: ink.light, r: 4.8 }),
  ];
}
