import { type Ink, stroke } from "@repo/mascot/medal/ink";
import { circle, group, path, rect, type Shape } from "@repo/mascot/shape";
import { sparkle } from "@repo/mascot/sparkle";

/** Three bars under a line that climbs: economy. */
export function chart(ink: Ink): readonly Shape[] {
  return [
    rect({ fill: ink.light, height: 17, rx: 3, width: 12, x: 36, y: 63 }),
    rect({ fill: ink.second, height: 27, rx: 3, width: 12, x: 54, y: 53 }),
    rect({ fill: ink.light, height: 37, rx: 3, width: 12, x: 72, y: 43 }),
    stroke("M36,52 L50,42 L60,46 L80,29", ink.first, 3.6),
    stroke("M70,29 L80,29 L80,39", ink.first, 3.6),
  ];
}

/** An hourglass, its sand half run: history. */
export function glass(ink: Ink): readonly Shape[] {
  return [
    path({
      d: "M45,34 L75,34 C75,46 65,50 65,55 C65,60 75,64 75,76 L45,76 C45,64 55,60 55,55 C55,50 45,46 45,34 Z",
      fill: ink.light,
    }),
    path({
      d: "M50,43 L70,43 C68,47 63,50 60,53 C57,50 52,47 50,43 Z",
      fill: ink.first,
    }),
    path({
      d: "M49,76 C50,69 56,66 60,64 C64,66 70,69 71,76 Z",
      fill: ink.first,
    }),
    stroke("M60,53 L60,65", ink.first, 1.8),
    rect({ fill: ink.dark, height: 7, rx: 3.5, width: 38, x: 41, y: 28 }),
    rect({ fill: ink.dark, height: 7, rx: 3.5, width: 38, x: 41, y: 75 }),
  ];
}

/** Three people side by side: sociology. */
export function people(ink: Ink): readonly Shape[] {
  const person = (x: number, fill: string) => [
    circle({ cx: x, cy: 43, fill, r: 7.4 }),
    path({
      d: `M${x - 13},74 C${x - 13},61 ${x - 7},54 ${x},54 C${x + 7},54 ${x + 13},61 ${x + 13},74 Z`,
      fill,
    }),
  ];
  return [
    ...person(42, ink.second),
    ...person(78, ink.third),
    circle({ cx: 60, cy: 42, fill: ink.light, r: 9.4 }),
    path({
      d: "M43,81 C43,65 50,56 60,56 C70,56 77,65 77,81 Z",
      fill: ink.light,
    }),
  ];
}

/** A vote going into its box: political science. */
export function ballot(ink: Ink): readonly Shape[] {
  return [
    group(
      [
        rect({ fill: ink.light, height: 30, rx: 3, width: 24, x: 48, y: 25 }),
        stroke("M54,36 L58,40 L66,31", ink.first, 3),
      ],
      { transform: "rotate(-8 60 40)" }
    ),
    rect({ fill: ink.second, height: 31, rx: 7, width: 50, x: 35, y: 50 }),
    rect({ fill: ink.dark, height: 5, rx: 2.5, width: 30, x: 45, y: 48 }),
    sparkle(60, 67, 6.4, ink.light),
  ];
}

/** Two flags on crossed poles: international relations. */
export function flags(ink: Ink): readonly Shape[] {
  return [
    stroke("M67,80 L43,29", ink.dark, 3.2),
    stroke("M53,80 L77,29", ink.dark, 3.2),
    path({
      d: "M43,29 C48,33 53,26 59,30 L59,50 C56,46.4 54,51 52.4,49 Z",
      fill: ink.first,
    }),
    path({
      d: "M77,29 C72,33 67,26 61,30 L61,50 C64,46.4 66,51 67.6,49 Z",
      fill: ink.second,
    }),
  ];
}
