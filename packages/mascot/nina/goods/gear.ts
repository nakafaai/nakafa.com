import { BASE, BOARD, LID, NINA, PAGE, PAPER, POP } from "@repo/mascot/color";
import type { Parts } from "@repo/mascot/nina/goods/part";
import { bar, box, dot, flat, turned } from "@repo/mascot/nina/goods/part";
import { sparkle } from "@repo/mascot/sparkle";
import { Array as Arr } from "effect";

/** A ribbon tied in a bow round her raised arm, so she does not forget. */
export function bow(swing: number): Parts {
  return [
    flat(
      `M0,8 C-18,-6 -26,4 -${24 + swing * 2},18 C-14,18 -6,14 0,8 Z`,
      POP.red
    ),
    flat(`M0,8 C18,-6 26,4 ${24 + swing * 2},18 C14,18 6,14 0,8 Z`, POP.red),
    bar("M-2,10 L-8,30 M2,10 L8,30", POP.red, 4),
    dot(0, 8, 5, POP.orange),
  ];
}

/** Binoculars at her eyes. */
export function binoculars(swing: number): Parts {
  return [
    box(-12, -8, 24, 12, BASE, 3),
    ...Arr.flatMap([-24, 24], (x) => [
      dot(x, 0, 21, NINA.ink),
      dot(x, 0, 15, POP.blue),
      dot(x - 5 + swing * 2, -5, 5, PAGE),
    ]),
  ];
}

/** A gown on its hanger, held up. */
export function gown(swing: number): Parts {
  return [
    bar("M0,-6 C0,-14 8,-14 8,-8", BASE, 3),
    bar("M-22,6 L0,-6 L22,6", BASE, 3),
    flat(
      `M-22,6 L-8,2 L0,8 L8,2 L22,6 L${30 + swing * 3},62 L-${30 - swing * 3},62 Z`,
      NINA.ink
    ),
    flat("M-8,2 L0,8 L8,2 L4,30 L0,34 L-4,30 Z", POP.yellow),
  ];
}

/** A door sign on its cord, still without a name. */
export function sign(swing: number): Parts {
  return [
    bar("M0,0 L-22,20 M0,0 L22,20", NINA.ink, 2.5),
    turned(
      [
        box(-32, 0, 64, 30, PAGE, 5),
        box(-32, 0, 64, 8, POP.blue, 5),
        bar("M-18,18 L18,18", LID, 4),
      ],
      0,
      20,
      swing * 3
    ),
  ];
}

/** A key held up to a padlock that it does not fit. */
export function key(swing: number): Parts {
  return [
    bar("M-9,-72 C-9,-90 17,-90 17,-72", BASE, 5),
    box(-15, -72, 38, 28, LID, 6),
    dot(4, -58, 4, NINA.ink),
    turned(
      [
        dot(0, 0, 10, POP.yellow),
        dot(0, 0, 4.2, PAGE),
        box(-3, -36, 6, 28, POP.yellow, 2),
        box(3, -34, 8, 5, POP.yellow, 1),
        box(3, -26, 6, 5, POP.yellow, 1),
      ],
      4,
      -4,
      swing * 14
    ),
  ];
}

/** A first brick laid on the floor, and the trowel in her hand. */
export function brick(swing: number): Parts {
  return [
    flat("M-10,-6 L14,-6 L22,12 L2,16 Z", LID),
    bar("M0,0 L2,-8", BOARD, 6),
    box(-36, 32, 44, 18, POP.orange, 3),
    bar(
      "M-36,41 L8,41 M-14,32 L-14,41 M-24,41 L-24,50 M-2,41 L-2,50",
      PAPER,
      2
    ),
    box(-40, 26 - Math.max(0, swing) * 2, 52, 6, LID, 3),
  ];
}

/** A radar screen with a calm sweep and nothing on it. */
export function radar(swing: number): Parts {
  return [
    box(-36, -34, 72, 66, LID, 10),
    dot(0, -2, 26, NINA.ink),
    bar(
      "M0,-2 m-17,0 a17,17 0 1,0 34,0 a17,17 0 1,0 -34,0 M0,-2 m-8,0 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0",
      POP.green,
      1.6
    ),
    turned(
      [flat("M0,0 L0,-25 A25,25 0 0,1 18,-17 Z", POP.green)],
      0,
      -2,
      swing * 170
    ),
    dot(0, -2, 2.6, POP.green),
  ];
}

/** A megaphone she calls a roll through. */
export function megaphone(swing: number): Parts {
  return [
    turned(
      [
        flat("M-8,-7 L-8,7 L30,22 L30,-22 Z", POP.red),
        box(-18, -8, 12, 16, PAGE, 3),
        box(28, -24, 7, 48, PAGE, 3),
        bar("M-10,8 L-6,24", BASE, 5),
      ],
      -6,
      -16,
      -44,
      0.78
    ),
    bar(
      `M14,-58 L${19 + swing * 2},-68 M22,-48 L${29 + swing * 2},-54 M4,-62 L${4 + swing * 2},-74`,
      POP.orange,
      3
    ),
  ];
}

/** A graduation cap and the brush she dusts it with. */
export function cap(swing: number): Parts {
  return [
    flat("M-22,-2 L22,-2 L20,16 C8,24 -8,24 -20,16 Z", NINA.ink),
    flat("M0,-24 L42,-6 L0,10 L-42,-6 Z", NINA.ink),
    bar("M0,-7 L30,-2 L30,14", POP.yellow, 2.5),
    box(26, 14, 8, 12, POP.yellow, 2),
    turned(
      [box(-4, -26, 8, 20, BOARD, 3), box(-8, -8, 16, 12, PAPER, 2)],
      -34 + swing * 6,
      -24,
      -30
    ),
  ];
}

/** A tray that takes a sheet in, line by line. */
export function feeder(swing: number): Parts {
  const fed = (swing + 1) * 8;
  return [
    box(-20, -44 + fed, 40, 36, PAGE, 2),
    bar(
      `M-12,${-34 + fed} L12,${-34 + fed} M-12,${-26 + fed} L6,${-26 + fed}`,
      LID,
      3
    ),
    box(-38, -10, 76, 38, LID, 8),
    box(-28, -12, 56, 7, NINA.ink, 3),
    dot(24, 14, 4, POP.green),
    box(-28, 10, 30, 7, BASE, 3),
  ];
}

/** A stop sign on its stick. */
export function stop(swing: number): Parts {
  return [
    bar("M0,6 L0,-12", BOARD, 6),
    flat(
      "M-9,-52 L9,-52 L21,-40 L21,-24 L9,-12 L-9,-12 L-21,-24 L-21,-40 Z",
      POP.red
    ),
    box(-13, -35, 26, 6, PAGE, 3),
    sparkle(26, -44 + swing * 2, 3, POP.red),
  ];
}

/** A sheet of stickers with every one still on it, the corner one lifting for whoever comes first. */
export function stickers(swing: number): Parts {
  return [
    box(-24, -30, 48, 60, PAGE, 5),
    ...Arr.map(
      [
        [-10, -16, POP.blue],
        [-10, 0, POP.orange],
        [10, 0, POP.green],
        [-10, 16, POP.yellow],
        [10, 16, POP.blue],
      ] as const,
      ([x, y, colour]) => dot(x, y, 6, colour)
    ),
    sparkle(10 + swing * 2, -16 - swing * 3, 6, POP.red),
  ];
}
