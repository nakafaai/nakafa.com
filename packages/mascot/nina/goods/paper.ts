import { BASE, BOARD, LID, NINA, PAGE, PAPER, POP } from "@repo/mascot/color";
import {
  bar,
  box,
  dot,
  flat,
  type Parts,
  turned,
} from "@repo/mascot/nina/goods/part";
import { sparkle } from "@repo/mascot/sparkle";
import { Array as Arr } from "effect";

/** Rows of writing on a page, from x, y, each `wide` long. */
function rows(x: number, y: number, wide: number, count: number) {
  return Arr.makeBy(count, (row) =>
    bar(
      `M${x},${y + row * 9} L${x + wide - (row % 2) * 10},${y + row * 9}`,
      BASE,
      3
    )
  );
}

/** A scroll she unrolls: the roll at its top, and the page that grows under it. */
export function scroll(swing: number): Parts {
  const long = 44 + swing * 8;
  return [
    box(-30, -30, 60, long, PAGE, 2),
    ...rows(-20, -16, 40, 3),
    box(-36, -38, 72, 12, PAPER, 6),
    dot(-36, -32, 6, BOARD),
    dot(36, -32, 6, BOARD),
    box(-32, -34 + long, 64, 8, PAPER, 4),
  ];
}

/** A great open book with a ribbon to keep its place. */
export function tome(swing: number): Parts {
  return [
    flat(
      "M-44,-22 C-30,-30 -12,-28 0,-20 C12,-28 30,-30 44,-22 L44,26 C30,18 12,20 0,28 C-12,20 -30,18 -44,26 Z",
      POP.green
    ),
    flat("M-39,-22 C-28,-27 -12,-25 0,-17 L0,24 C-12,16 -28,14 -39,20 Z", PAGE),
    flat("M39,-22 C28,-27 12,-25 0,-17 L0,24 C12,16 28,14 39,20 Z", PAGE),
    ...rows(-32, -10, 24, 3),
    flat(
      `M8,-18 C${16 + swing * 6},-34 34,-30 36,-21 L36,18 C26,12 16,14 8,20 Z`,
      PAPER
    ),
    flat("M-4,20 L4,20 L4,40 L0,35 L-4,40 Z", POP.red),
  ];
}

/** A certificate's seal held up to the light, which shines through it. */
export function seal(swing: number): Parts {
  return [
    flat("M-9,-8 L-15,14 L-6,9 L0,16 L6,9 L15,14 L9,-8 Z", POP.red),
    dot(0, -22, 19, POP.yellow),
    dot(0, -22, 12, POP.orange),
    flat(
      "M0,-31 L3,-25 L9,-24 L5,-19 L6,-13 L0,-16 L-6,-13 L-5,-19 L-9,-24 L-3,-25 Z",
      PAGE
    ),
    sparkle(22, -42 - swing * 3, 5 + swing, POP.yellow),
  ];
}

/** A seat plan on a board: rows of seats, and the one she looks for. */
export function plan(swing: number): Parts {
  const found = swing > 0 ? 7 : 2;
  return [
    box(-38, -30, 76, 60, BOARD, 6),
    box(-33, -25, 66, 50, PAGE, 3),
    ...Arr.makeBy(12, (seat) =>
      box(
        -27 + (seat % 4) * 14,
        -18 + Math.floor(seat / 4) * 14,
        10,
        9,
        seat === found ? POP.orange : LID,
        2
      )
    ),
  ];
}

/** A pencil in a sharpener, and the curl of wood that comes off it. */
export function sharpener(swing: number): Parts {
  return [
    box(-36, -6, 46, 12, POP.yellow, 2),
    flat("M10,-6 L26,0 L10,6 Z", PAPER),
    flat("M20,-2 L26,0 L20,2 Z", NINA.ink),
    box(-40, -6, 8, 12, POP.red, 3),
    box(14, -14, 26, 28, LID, 6),
    box(22, -8, 12, 5, BASE, 2),
    bar(`M30,16 C${38 + swing * 3},24 26,30 ${32 + swing * 3},38`, PAPER, 4),
  ];
}

/** A rolled diploma with its ribbon. */
export function diploma(swing: number): Parts {
  return [
    turned(
      [
        box(-34, -9, 68, 18, PAGE, 9),
        dot(-34, 0, 9, PAPER),
        dot(34, 0, 9, PAPER),
        box(-5, -10, 10, 20, POP.red, 2),
        flat(
          `M-5,10 L-12,${26 + swing * 2} L-3,22 L0,${30 + swing * 2} L3,22 L12,${26 + swing * 2} L5,10 Z`,
          POP.red
        ),
      ],
      -8,
      -22,
      -28
    ),
  ];
}

/** Name tags on one string, each still blank. */
export function tags(swing: number): Parts {
  return [
    bar("M-44,-22 C-20,-12 20,-12 44,-22", NINA.ink, 2.5),
    ...Arr.map(
      [
        [-30, POP.blue, 4],
        [0, POP.yellow, 6],
        [30, POP.red, 8],
      ] as const,
      ([x, colour, sway]) =>
        turned(
          [
            bar("M0,-8 L0,0", NINA.ink, 2),
            box(-12, 0, 24, 30, colour, 4),
            box(-8, 10, 16, 12, PAGE, 2),
          ],
          x,
          -10 - Math.abs(x) * 0.12,
          swing * sway
        )
    ),
  ];
}

/** A tray of cards she sorts, one card lifted out. */
export function tray(swing: number): Parts {
  return [
    box(-18, -34 - swing * 4, 26, 30, PAGE, 3),
    box(-14, -28 - swing * 4, 18, 4, POP.blue, 2),
    box(-38, -6, 76, 34, BOARD, 6),
    box(-32, -14, 20, 16, POP.yellow, 2),
    box(-8, -12, 20, 14, POP.red, 2),
    box(14, -16, 20, 18, POP.green, 2),
    box(-38, 2, 76, 26, BOARD, 6),
  ];
}

/** Scissors held by one ring, and the card they cut from a sheet. */
export function scissors(swing: number): Parts {
  const open = 10 + swing * 8;
  return [
    box(-6, -62, 30, 40, PAGE, 3),
    bar("M0,-50 L16,-50", BASE, 2.5),
    bar("M-6,-40 L24,-40", NINA.ink, 1.5),
    turned(
      [
        bar("M0,-6 L0,-44", BASE, 5),
        dot(0, 4, 8, POP.red),
        dot(0, 4, 3.4, PAGE),
      ],
      0,
      0,
      open
    ),
    turned(
      [
        bar("M0,-6 L0,-44", LID, 5),
        dot(0, 4, 8, POP.red),
        dot(0, 4, 3.4, PAGE),
      ],
      0,
      0,
      -open
    ),
  ];
}

/** A pile of handed in sheets, the top one sliding. */
export function sheets(swing: number): Parts {
  return [
    turned([box(-30, -8, 60, 38, PAPER, 3)], 0, 2, -5),
    turned([box(-30, -12, 60, 38, PAGE, 3)], 0, 0, 3),
    turned(
      [
        box(-30, -18, 60, 38, PAGE, 3),
        ...rows(-22, -8, 44, 3),
        bar("M12,10 L17,15 L26,3", POP.green, 3),
      ],
      swing * 4,
      -6,
      -2
    ),
  ];
}

/** A grade book, open: a column of names and a column of marks she fills. */
export function gradebook(swing: number): Parts {
  const filled = swing > 0 ? 3 : 2;
  return [
    box(-42, -28, 84, 56, POP.blue, 6),
    box(-37, -24, 36, 48, PAGE, 2),
    box(1, -24, 36, 48, PAGE, 2),
    ...rows(-31, -14, 24, 4),
    ...Arr.makeBy(filled, (row) => box(8, -18 + row * 9, 20, 6, POP.yellow, 2)),
  ];
}

/** A report cover held open, with nothing in it yet. */
export function cover(swing: number): Parts {
  return [
    flat(
      `M0,-28 L-${40 + swing * 3},-34 L-${40 + swing * 3},24 L0,30 Z`,
      POP.blue
    ),
    flat(
      `M0,-28 L${40 + swing * 3},-34 L${40 + swing * 3},24 L0,30 Z`,
      POP.blue
    ),
    flat("M0,-22 L-33,-27 L-33,19 L0,24 Z", PAGE),
    flat("M0,-22 L33,-27 L33,19 L0,24 Z", PAGE),
    bar("M10,-6 L26,-9 M10,4 L22,2", LID, 3),
  ];
}

/** A sealed letter she hands over. */
export function letter(swing: number): Parts {
  return [
    turned(
      [
        box(-26, -18, 52, 36, PAGE, 4),
        bar("M-26,-16 L0,4 L26,-16", PAPER, 3),
        dot(0, 5, 7 + swing, POP.red),
      ],
      -4,
      -24,
      -12
    ),
  ];
}

/** A name badge on its cord, with a face and no name yet. */
export function badge(swing: number): Parts {
  return [
    bar("M-16,-40 L-4,-22 M16,-40 L4,-22", POP.blue, 4),
    box(-30, -22, 60, 50, PAGE, 8),
    box(-8, -28, 16, 9, BASE, 3),
    dot(0, -4, 10, NINA.body),
    bar(`M-16,14 L${10 + swing * 6},14`, BASE, 4),
  ];
}

/** A fan of blank question cards she shuffles. */
export function fan(swing: number): Parts {
  return Arr.map(
    [
      [-2, POP.blue],
      [-1, POP.green],
      [0, POP.orange],
      [1, POP.red],
      [2, POP.yellow],
    ] as const,
    ([card, colour]) =>
      turned(
        [
          box(-15, -46, 30, 44, PAGE, 4),
          box(-11, -42, 22, 36, colour, 3),
          dot(0, -24, 6, PAGE),
        ],
        0,
        24,
        card * (17 + swing * 4)
      )
  );
}

/** An in tray with nothing in it but one corner of dust. */
export function inbox(swing: number): Parts {
  return [
    flat("M-40,-4 L40,-4 L34,26 L-34,26 Z", BASE),
    flat("M-34,2 L34,2 L30,20 L-30,20 Z", PAGE),
    bar("M-14,26 L14,26", NINA.ink, 5),
    sparkle(26, -18 - swing * 3, 5, POP.yellow),
    bar(`M-20,-16 C-14,${-24 - swing * 3} -4,-12 2,-20`, BASE, 2.5),
  ];
}

/** A ruler laid on a sheet, and the table she rules with it. */
export function ruler(swing: number): Parts {
  return [
    box(-38, -30, 76, 58, PAGE, 3),
    bar("M-28,-16 L28,-16 M-28,-2 L28,-2 M-28,12 L28,12", LID, 2.5),
    bar("M-8,-22 L-8,20", LID, 2.5),
    turned(
      [
        box(-44, -7, 88, 14, POP.yellow, 3),
        ...Arr.makeBy(9, (tick) =>
          bar(
            `M${-36 + tick * 9},-7 L${-36 + tick * 9},${tick % 2 === 0 ? 0 : -3}`,
            NINA.ink,
            1.6
          )
        ),
      ],
      0,
      16 + swing * 3,
      -8
    ),
  ];
}

/** A certificate with a ribbon, held up for a reader to see. */
export function certificate(swing: number): Parts {
  return [
    box(-40, -30, 80, 58, PAPER, 4),
    box(-34, -24, 68, 46, PAGE, 2),
    bar("M-18,-12 L18,-12", NINA.ink, 3.5),
    bar("M-24,-1 L24,-1 M-20,8 L8,8", LID, 3),
    flat("M18,10 L14,30 L22,25 L30,30 L26,10 Z", POP.red),
    dot(22, 8, 8 + swing, POP.yellow),
  ];
}

/** A ribbon between her arms and the scissors that cut it, for an opening. */
export function ribbon(swing: number): Parts {
  const drop = Math.max(0, swing) * 10;
  return [
    bar(`M-70,0 C-50,10 -20,${12 + drop} -4,${4 + drop}`, POP.red, 7),
    bar(`M70,0 C50,10 20,${12 + drop} 4,${4 + drop}`, POP.red, 7),
    turned(
      [bar("M0,0 L0,-22", BASE, 4), dot(0, 6, 6, POP.yellow)],
      -3,
      -8,
      14 + swing * 10
    ),
    turned(
      [bar("M0,0 L0,-22", LID, 4), dot(0, 6, 6, POP.yellow)],
      3,
      -8,
      -14 - swing * 10
    ),
    sparkle(0, -40, 4 + drop * 0.4, POP.yellow),
  ];
}

/** A picture frame with nobody in it yet. */
export function frame(swing: number): Parts {
  return [
    box(-36, -32, 72, 62, BOARD, 6),
    box(-28, -24, 56, 46, PAGE, 2),
    dot(0, -6, 9, LID),
    flat("M-16,22 C-16,6 16,6 16,22 Z", LID),
    sparkle(22, -18 + swing * 2, 4, POP.yellow),
  ];
}

/**
 * A letter she folds into an envelope: the open flap behind, the letter half inside with two faint lines of
 * writing, and the pocket in front, outlined in her ink so the paper shows on a light page too.
 */
export function insert(swing: number): Parts {
  return [
    flat("M-26,-4 L0,-24 L26,-4 Z", PAPER),
    bar("M-26,-4 L0,-24 L26,-4", NINA.ink, 2.5),
    box(-17, -30 + swing * 2, 34, 36, PAGE, 2),
    bar(
      `M-17,${6 + swing * 2} L-17,${-30 + swing * 2} L17,${-30 + swing * 2} L17,${6 + swing * 2}`,
      NINA.ink,
      2.5
    ),
    bar(`M-10,${-21 + swing * 2} L10,${-21 + swing * 2}`, BASE, 2.5),
    bar(`M-10,${-13 + swing * 2} L5,${-13 + swing * 2}`, BASE, 2.5),
    box(-26, -4, 52, 30, PAPER, 3),
    bar("M-26,-4 L-26,26 L26,26 L26,-4 Z", NINA.ink, 2.5),
    bar("M-26,26 L0,8 L26,26", NINA.ink, 2),
  ];
}

/**
 * A paper plane held by its body before the throw, its nose toward where it will fly: the near wing, the far wing
 * under it, and the fold between them, outlined in her ink so the paper shows on a light page too. It does not move
 * by itself; the arm that holds it rocks.
 */
export function dart(): Parts {
  return [
    flat("M-30,6 L32,-12 L-6,16 Z", PAGE),
    flat("M-6,16 L32,-12 L0,26 Z", PAPER),
    bar("M-30,6 L32,-12 L0,26 L-6,16 Z", NINA.ink, 2.5),
    bar("M-6,16 L32,-12", NINA.ink, 2.5),
  ];
}

/** A wall calendar, its top page lifting. */
export function calendar(swing: number): Parts {
  return [
    box(-32, -30, 64, 60, PAGE, 6),
    box(-32, -30, 64, 16, POP.red, 6),
    dot(-16, -30, 4, BASE),
    dot(16, -30, 4, BASE),
    ...Arr.makeBy(8, (day) =>
      box(-24 + (day % 4) * 13, -6 + Math.floor(day / 4) * 13, 9, 9, LID, 2)
    ),
    flat(`M32,30 L${14 - swing * 4},30 L32,${12 - swing * 4} Z`, PAPER),
  ];
}

/** A ticket and the punch that checks it. */
export function ticket(swing: number): Parts {
  return [
    turned(
      [
        box(-26, -14, 52, 28, POP.yellow, 4),
        dot(-26, 0, 5, PAGE),
        dot(26, 0, 5, PAGE),
        bar("M8,-10 L8,10", BOARD, 2),
        bar("M-16,-4 L0,-4 M-16,4 L-4,4", BOARD, 3),
        dot(17, 0, 3 + Math.max(0, swing) * 1.5, NINA.ink),
      ],
      -4,
      -22,
      -10
    ),
  ];
}

/** An open book of blank pages, and what might be written on them. */
export function blank(swing: number): Parts {
  return [
    flat(
      "M-42,-14 C-28,-22 -12,-20 0,-12 C12,-20 28,-22 42,-14 L42,26 C28,18 12,20 0,28 C-12,20 -28,18 -42,26 Z",
      POP.orange
    ),
    flat("M-37,-15 C-26,-20 -12,-17 0,-9 L0,24 C-12,16 -26,14 -37,20 Z", PAGE),
    flat("M37,-15 C26,-20 12,-17 0,-9 L0,24 C12,16 26,14 37,20 Z", PAGE),
    sparkle(-18, -34 - swing * 4, 6, POP.yellow),
    sparkle(8, -44 + swing * 3, 4, POP.blue),
    sparkle(26, -30 - swing * 2, 5, POP.red),
  ];
}

/** A sheet of answers she marks with a red pen. */
export function marked(swing: number): Parts {
  return [
    box(-34, -32, 60, 62, PAGE, 3),
    ...rows(-26, -20, 32, 5),
    bar("M10,-22 L14,-18 L20,-26", POP.red, 3),
    bar("M10,-4 L18,4 M18,-4 L10,4", POP.red, 3),
    turned(
      [box(-4, -30, 8, 30, POP.red, 3), flat("M-4,0 L4,0 L0,8 Z", PAPER)],
      30 + swing * 3,
      10 + swing * 2,
      30
    ),
  ];
}

/** Blank report covers and the thread that binds them. */
export function covers(swing: number): Parts {
  return [
    box(-36, 6, 72, 12, POP.green, 3),
    box(-34, -6, 72, 12, POP.blue, 3),
    box(-38, -18, 72, 12, POP.red, 3),
    bar("M-10,-26 L-10,24 M14,-26 L14,24", PAPER, 3),
    bar(
      `M-10,-26 C-4,${-38 - swing * 4} 8,${-38 - swing * 4} 14,-26`,
      PAPER,
      3
    ),
  ];
}

/** A closed book and the ribbon that keeps the place she will come back to. */
export function bookmark(swing: number): Parts {
  return [
    box(-30, -36, 60, 72, POP.blue, 5),
    box(-30, -36, 9, 72, NINA.ink, 4),
    box(-12, -22, 32, 16, PAGE, 2),
    bar("M-6,-14 L14,-14", LID, 3),
    flat(
      `M8,-36 L22,-36 L22,${-2 + swing * 3} L15,${-9 + swing * 3} L8,${-2 + swing * 3} Z`,
      POP.red
    ),
  ];
}
