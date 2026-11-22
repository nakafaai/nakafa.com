import { BASE, BOARD, LID, NINA, PAGE, PAPER, POP } from "@repo/mascot/color";
import type { Parts } from "@repo/mascot/nina/goods/part";
import { bar, box, dot, flat, turned } from "@repo/mascot/nina/goods/part";
import { sparkle } from "@repo/mascot/sparkle";

/** A wrench held by its handle, its jaw up, and the loose nut it turns. */
export function wrench(swing: number): Parts {
  return [
    bar("M0,4 L0,-40", BASE, 9),
    flat(
      "M-13,-58 L-13,-40 C-13,-30 13,-30 13,-40 L13,-58 L5,-58 L5,-46 L-5,-46 L-5,-58 Z",
      BASE
    ),
    turned(
      [
        flat("M-8,-5 L0,-9 L8,-5 L8,5 L0,9 L-8,5 Z", POP.orange),
        dot(0, 0, 3, PAGE),
      ],
      18,
      -66,
      swing * 40
    ),
  ];
}

/** A folded map held upside down: its route runs off the top and its pin points the wrong way. */
export function atlas(): Parts {
  return [
    flat(
      "M-40,-26 L-14,-32 L14,-26 L40,-32 L40,26 L14,32 L-14,26 L-40,32 Z",
      PAGE
    ),
    flat("M-14,-32 L14,-26 L14,32 L-14,26 Z", PAPER),
    bar("M-30,18 C-18,2 -8,16 4,0 S24,-14 32,-22", POP.red, 3),
    flat("M24,6 C16,6 16,18 24,26 C32,18 32,6 24,6 Z", POP.blue),
    dot(24, 14, 3, PAGE),
  ];
}

/** A question mark that floats over her while she shrugs. */
export function question(swing: number): Parts {
  return [
    bar("M-9,-6 C-9,-20 11,-20 11,-7 C11,2 1,2 1,12", POP.orange, 7),
    dot(1, 25 + swing, 4.6, POP.orange),
  ];
}

/** A cable in a tangle, both of its plugs hanging out. */
export function tangle(swing: number): Parts {
  return [
    bar(
      "M-30,6 C-36,-22 -4,-30 2,-10 C8,10 -24,20 -12,-6 C-2,-28 30,-22 26,0 C22,22 -8,24 -2,6 C4,-10 34,-4 30,14",
      NINA.ink,
      4
    ),
    turned(
      [
        box(-6, 0, 12, 14, POP.orange),
        box(-4, 14, 3, 7, BASE, 1),
        box(1, 14, 3, 7, BASE, 1),
      ],
      -32,
      8 + swing * 2,
      12
    ),
    turned(
      [
        box(-6, 0, 12, 14, POP.blue),
        box(-4, 14, 3, 7, BASE, 1),
        box(1, 14, 3, 7, BASE, 1),
      ],
      32,
      14 - swing * 2,
      -12
    ),
  ];
}

/** Two cable ends, one in each arm, that do not reach each other, and the spark between them. */
export function ends(swing: number): Parts {
  const gap = 20 + swing * 6;
  return [
    bar(`M-70,2 C-60,18 -48,12 -${gap + 14},0`, NINA.ink, 4),
    box(-gap - 16, -8, 16, 16, POP.orange, 4),
    box(-gap, -5, 7, 3, BASE, 1),
    box(-gap, 2, 7, 3, BASE, 1),
    bar(`M70,2 C60,18 48,12 ${gap + 14},0`, NINA.ink, 4),
    box(gap, -9, 18, 18, PAGE, 4),
    dot(gap + 6, -3, 2, NINA.ink),
    dot(gap + 6, 4, 2, NINA.ink),
    sparkle(0, -14 - swing * 3, 6 + swing * 2, POP.yellow),
  ];
}

/** A small machine with one antenna, a dark screen and a restart button that she presses. */
export function robot(swing: number): Parts {
  return [
    bar("M0,-30 L0,-42", BASE, 4),
    dot(0, -45, 5, swing > 0 ? POP.green : POP.red),
    box(-34, -30, 68, 56, LID, 10),
    box(-26, -22, 52, 28, NINA.ink, 6),
    bar("M-14,-6 L-6,-6 M6,-6 L14,-6", NINA.face, 4),
    dot(-18, 16, 5, POP.orange),
    box(-4, 12, 26, 8, BASE, 4),
  ];
}

/** A switchboard: rows of lamps, and cords she moves between its sockets. */
export function switchboard(swing: number): Parts {
  const lit = swing > 0 ? 0 : 1;
  return [
    box(-40, -34, 80, 64, BOARD, 8),
    box(-34, -28, 68, 30, NINA.ink, 5),
    dot(-22, -18, 4, lit === 0 ? POP.green : BASE),
    dot(-8, -18, 4, lit === 1 ? POP.green : BASE),
    dot(6, -18, 4, POP.yellow),
    dot(20, -18, 4, BASE),
    dot(-22, -6, 4, BASE),
    dot(-8, -6, 4, POP.red),
    dot(6, -6, 4, BASE),
    dot(20, -6, 4, lit === 0 ? BASE : POP.blue),
    bar("M-22,12 C-22,26 6,26 6,12", POP.red, 3),
    bar("M-8,12 C-8,32 20,32 20,12", POP.blue, 3),
    dot(-22, 12, 4, PAGE),
    dot(-8, 12, 4, PAGE),
    dot(6, 12, 4, PAGE),
    dot(20, 12, 4, PAGE),
  ];
}

/** A dustpan she holds at the floor, and the broken pieces she sweeps into it. */
export function dustpan(swing: number): Parts {
  return [
    bar("M0,0 L10,18", BASE, 6),
    flat("M-8,18 L34,18 L42,40 L-16,40 Z", POP.blue),
    flat(`M${-34 + swing * 4},40 L-26,28 L-18,40 Z`, POP.orange),
    flat(`M${-50 + swing * 3},40 L-44,32 L-38,40 Z`, POP.yellow),
    flat("M10,26 L20,22 L22,34 Z", POP.red),
    dot(30, 30, 3, POP.green),
  ];
}

/** Two cans on one string, the far one beside her: a telephone with nobody on the line yet. */
export function cans(swing: number): Parts {
  return [
    bar(
      `M12,0 C30,${14 + swing * 5} 38,${36 - swing * 5} 28,58 C22,78 4,86 -20,90`,
      NINA.ink,
      2.5
    ),
    box(-12, -14, 24, 28, LID, 4),
    box(-12, -14, 24, 6, BASE, 3),
    turned(
      [box(-11, -13, 22, 26, LID, 4), box(-11, 7, 22, 6, BASE, 3)],
      -30,
      92,
      70
    ),
  ];
}

/** Two links of a chain, one in each arm, that she brings together. */
export function links(swing: number): Parts {
  const gap = 12 + swing * 8;
  return [
    bar(`M-70,0 L-${gap + 30},0`, BASE, 6),
    bar(
      `M-${gap + 26},-12 L-${gap + 2},-12 C-${gap - 10},-12 -${gap - 10},12 -${gap + 2},12 L-${gap + 26},12 C-${gap + 38},12 -${gap + 38},-12 -${gap + 26},-12 Z`,
      POP.yellow,
      7
    ),
    bar(`M70,0 L${gap + 30},0`, BASE, 6),
    bar(
      `M${gap + 26},-12 L${gap + 2},-12 C${gap - 10},-12 ${gap - 10},12 ${gap + 2},12 L${gap + 26},12 C${gap + 38},12 ${gap + 38},-12 ${gap + 26},-12 Z`,
      POP.orange,
      7
    ),
  ];
}

/** A lamp she holds out, lit, and its glow. */
export function lamp(swing: number): Parts {
  return [
    bar("M0,6 L0,-12", BASE, 6),
    box(-8, -20, 16, 9, BASE, 3),
    dot(0, -36, 19 + swing * 2, POP.yellow),
    flat(
      "M-16,-36 C-16,-58 16,-58 16,-36 C16,-28 8,-26 8,-20 L-8,-20 C-8,-26 -16,-28 -16,-36 Z",
      PAGE
    ),
    bar("M-5,-26 L-2,-36 L2,-36 L5,-26", POP.orange, 2.5),
  ];
}

/** A lantern she holds low, and the footprints its light finds on the floor. */
export function lantern(swing: number): Parts {
  return [
    bar("M0,0 C-10,4 -10,12 0,14 C10,12 10,4 0,0", BASE, 3),
    box(-13, 14, 26, 6, BASE, 3),
    box(-10, 20, 20, 24, PAGE, 4),
    dot(0, 32, 6 + swing, POP.yellow),
    box(-13, 44, 26, 6, BASE, 3),
    turned(
      [flat("M-4,-7 C-8,-7 -7,5 -3,7 C3,7 4,-5 0,-7 Z", BASE)],
      24,
      44,
      24
    ),
    turned(
      [flat("M-4,-7 C-8,-7 -7,5 -3,7 C3,7 4,-5 0,-7 Z", BASE)],
      36,
      32,
      24
    ),
    turned(
      [flat("M-4,-7 C-8,-7 -7,5 -3,7 C3,7 4,-5 0,-7 Z", BASE)],
      44,
      46,
      24
    ),
  ];
}
