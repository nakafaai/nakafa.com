import { BASE, BOARD, LID, NINA, PAGE, PAPER, POP } from "@repo/mascot/color";
import type { Parts } from "@repo/mascot/nina/goods/part";
import { bar, box, dot, flat, turned } from "@repo/mascot/nina/goods/part";
import { sparkle } from "@repo/mascot/sparkle";
import { Array as Arr } from "effect";

/** A cable wound into loops, its plug hanging free, ready to go back in. */
export function coil(swing: number): Parts {
  const end = 34 + swing * 3;
  return [
    bar("M-30,-10 C-30,-32 30,-32 30,-10 C30,10 -30,10 -30,-10", NINA.ink, 4),
    bar("M-22,-8 C-22,-24 22,-24 22,-8 C22,6 -22,6 -22,-8", NINA.ink, 4),
    bar(`M30,-10 C40,0 40,12 ${end},20`, NINA.ink, 4),
    box(end - 8, 18, 16, 14, POP.orange, 4),
    box(end - 5, 32, 3, 6, BASE, 1),
    box(end + 2, 32, 3, 6, BASE, 1),
  ];
}

/** A padlock that is shut, held to her chest. */
export function padlock(swing: number): Parts {
  return [
    bar("M-12,-24 C-12,-46 12,-46 12,-24", BASE, 6),
    box(-20, -26, 40, 32, POP.yellow, 6),
    dot(0, -14, 4.5, NINA.ink),
    box(-1.6, -12, 3.2, 9, NINA.ink, 1.5),
    sparkle(26, -40 - swing * 3, 5, PAGE),
  ];
}

/** A plug she pulled out, its cord hanging loose, with the jolt of letting go. */
export function unplugged(swing: number): Parts {
  return [
    bar(`M0,4 C-6,22 10,30 ${-4 + swing * 4},44`, NINA.ink, 3.5),
    box(-9, -22, 18, 26, POP.blue, 5),
    box(-6, -32, 4, 11, BASE, 1),
    box(2, -32, 4, 11, BASE, 1),
    bar("M-12,-40 L-17,-46 M0,-44 L0,-52 M12,-40 L17,-46", POP.red, 2.5),
  ];
}

/** A sieve held out by its handle, nothing caught in its mesh, two grains bouncing over it. */
export function sieve(swing: number): Parts {
  return [
    bar("M0,6 L0,-16", BOARD, 6),
    dot(0, -36, 21, BOARD),
    dot(0, -36, 17, PAGE),
    bar(
      "M-10,-48 L-10,-24 M0,-52 L0,-20 M10,-48 L10,-24 M-14,-42 L14,-42 M-16,-32 L16,-32",
      LID,
      1.8
    ),
    dot(-6, -62 - swing * 5, 3, POP.yellow),
    dot(8, -66 + swing * 4, 2.5, POP.yellow),
  ];
}

/** A signpost on the floor, its arrows pointing to other ways. */
export function signpost(swing: number): Parts {
  return [
    box(-3, -84, 6, 84, BOARD, 2),
    turned(
      [
        flat("M-4,-12 L16,-12 L26,0 L16,12 L-4,12 Z", POP.blue),
        bar("M2,0 L14,0", PAGE, 3),
      ],
      0,
      -68,
      swing * 4
    ),
    turned(
      [flat("M4,-10 L-26,-10 L-36,0 L-26,10 L4,10 Z", PAGE)],
      0,
      -40,
      -swing * 3
    ),
    box(-12, -4, 24, 6, BASE, 3),
  ];
}

/** A ring of keys, one for each room, swinging as she shakes it. */
export function keyring(swing: number): Parts {
  return [
    bar("M-10,0 C-10,-14 10,-14 10,0 C10,14 -10,14 -10,0", BASE, 3),
    ...Arr.map(
      [
        [-6, -28, POP.yellow],
        [0, 0, BOARD],
        [6, 28, POP.red],
      ] as const,
      ([x, turn, colour]) =>
        turned(
          [
            dot(0, 0, 6, colour),
            dot(0, 0, 2.4, PAGE),
            box(-2.5, 4, 5, 24, colour, 2),
            box(2.5, 20, 5, 3, colour, 1),
            box(2.5, 25, 4, 3, colour, 1),
          ],
          x,
          12,
          turn + swing * 10
        )
    ),
  ];
}

/** A board of puzzle pieces with one gap, and the missing piece she brings to it from the side. */
export function puzzle(swing: number): Parts {
  return [
    box(-40, -30, 80, 56, BOARD, 6),
    box(-34, -24, 32, 22, POP.blue, 3),
    box(2, -24, 32, 22, POP.yellow, 3),
    box(-34, 2, 32, 18, POP.green, 3),
    box(2, 2, 32, 18, NINA.ink, 3),
    turned(
      [
        box(-12, -8, 24, 16, POP.red, 3),
        dot(12, 0, 4, POP.red),
        dot(0, -8, 4, POP.red),
      ],
      58 + swing * 4,
      12,
      swing * 10
    ),
  ];
}

/** A big switch on a plate, its knob sliding over to on. */
export function toggle(swing: number): Parts {
  const on = (swing + 1) / 2;
  return [
    box(-40, -26, 80, 48, BASE, 10),
    box(-28, -12, 56, 22, on > 0.5 ? POP.green : LID, 11),
    dot(-16 + on * 32, -1, 9, PAGE),
  ];
}

/** A class photo: three classmates side by side in a white frame. */
export function photo(swing: number): Parts {
  return [
    box(-34, -44, 68, 64, PAGE, 4),
    box(-28, -38, 56, 40, LID, 2),
    ...Arr.map(
      [
        [-16, POP.blue],
        [0, POP.orange],
        [16, POP.green],
      ] as const,
      ([x, colour]) =>
        turned(
          [dot(0, -22, 6, colour), flat("M-9,2 C-9,-10 9,-10 9,2 Z", colour)],
          x,
          0,
          0
        )
    ),
    sparkle(30, -50 - swing * 3, 5, POP.yellow),
  ];
}

/** A feather quill, its nib down, ready for the first line. */
export function quill(swing: number): Parts {
  return [
    turned(
      [
        flat("M0,6 C-4,-10 -14,-40 -6,-64 C4,-50 10,-24 0,6 Z", PAPER),
        bar("M0,6 C-2,-16 -4,-40 -6,-60", BOARD, 1.8),
        flat("M-2.5,4 L2.5,4 L0,13 Z", NINA.ink),
      ],
      0,
      0,
      swing * 8
    ),
    dot(-12, 16, 2, NINA.ink),
  ];
}

/** A sheet she hands back with a red cross on it. */
export function returned(swing: number): Parts {
  return [
    flat("M-18,-58 L10,-58 L22,-46 L22,-4 L-18,-4 Z", PAGE),
    flat("M10,-58 L10,-46 L22,-46 Z", PAPER),
    bar("M-10,-46 L4,-46 M-10,-38 L12,-38", LID, 2.5),
    turned([bar("M-8,-8 L8,8 M8,-8 L-8,8", POP.red, 4.5)], 2, -20, swing * 6),
  ];
}

/** A compass, its needle swinging to find the way. */
export function compass(swing: number): Parts {
  return [
    box(-4, -44, 8, 8, BOARD, 3),
    dot(0, -14, 24, BOARD),
    dot(0, -14, 19, PAGE),
    bar("M0,-30 L0,-26 M0,2 L0,-2 M-16,-14 L-12,-14 M16,-14 L12,-14", LID, 2),
    turned(
      [flat("M0,-15 L4,0 L-4,0 Z", POP.red), flat("M0,15 L4,0 L-4,0 Z", BASE)],
      0,
      -14,
      swing * 40
    ),
    dot(0, -14, 2.5, NINA.ink),
  ];
}

/** A starting flag raised high, waving to open what begins. */
export function pennant(swing: number): Parts {
  const wave = swing * 3;
  return [
    bar("M0,8 L0,-34", BASE, 4),
    flat(
      `M0,-34 C10,${-38 + wave} 18,${-30 - wave} 28,-33 L28,-14 C18,${-11 - wave} 10,${-19 + wave} 0,-15 Z`,
      POP.green
    ),
    dot(0, -36, 3.5, POP.yellow),
  ];
}

/** Two cards, one in each hand, swung toward each other to change places. */
export function swap(swing: number): Parts {
  const card = (colour: string) => [
    box(-14, -20, 28, 36, colour, 4),
    box(-8, -12, 16, 6, PAGE, 2),
  ];
  return [
    turned(card(POP.blue), -46 + swing * 4, 0, -10 + swing * 14),
    turned(card(POP.yellow), 46 - swing * 4, 0, 10 - swing * 14),
  ];
}
