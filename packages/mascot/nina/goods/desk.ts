import { BASE, BOARD, LID, NINA, PAGE, PAPER, POP } from "@repo/mascot/color";
import type { Parts } from "@repo/mascot/nina/goods/part";
import { bar, box, dot, flat, turned } from "@repo/mascot/nina/goods/part";
import { sparkle } from "@repo/mascot/sparkle";
import { Array as Arr } from "effect";

/** An hourglass she holds out, its sand running. */
export function hourglass(swing: number): Parts {
  const run = (swing + 1) / 2;
  return [
    box(-17, -52, 34, 7, BOARD, 3),
    box(-17, -4, 34, 7, BOARD, 3),
    flat(
      "M-13,-45 L13,-45 C13,-30 3,-28 3,-24 C3,-20 13,-18 13,-4 L-13,-4 C-13,-18 -3,-20 -3,-24 C-3,-28 -13,-30 -13,-45 Z",
      PAGE
    ),
    flat(
      `M-${9 - run * 5},${-40 + run * 8} L${9 - run * 5},${-40 + run * 8} C6,-32 2,-29 0,-26 C-2,-29 -6,-32 -${9 - run * 5},${-40 + run * 8} Z`,
      POP.yellow
    ),
    flat(`M-11,-5 C-11,${-9 - run * 9} 11,${-9 - run * 9} 11,-5 Z`, POP.yellow),
    bar("M0,-24 L0,-8", POP.yellow, 1.6),
  ];
}

/** A stopwatch she watches, its hand going round. */
export function stopwatch(swing: number): Parts {
  return [
    box(-5, -62, 10, 9, BASE, 3),
    dot(0, -30, 25, BASE),
    dot(0, -30, 20, PAGE),
    turned([bar("M0,0 L0,-14", POP.red, 3)], 0, -30, swing * 150),
    dot(0, -30, 3, NINA.ink),
    bar("M17,-52 L22,-57", BASE, 5),
  ];
}

/** A balance with two pans, one a little heavier than the other. */
export function scale(swing: number): Parts {
  const tip = swing * 6;
  return [
    bar("M0,-30 L0,24 M-18,26 L18,26", BASE, 6),
    turned(
      [
        bar("M-36,0 L36,0", BOARD, 5),
        bar("M-36,0 L-36,16 M36,0 L36,16", BASE, 2.5),
        flat("M-48,16 C-48,28 -24,28 -24,16 Z", POP.yellow),
        flat("M24,16 C24,28 48,28 48,16 Z", POP.yellow),
        dot(-36, 12, 6, POP.red),
        box(30, 6, 12, 10, POP.blue, 2),
      ],
      0,
      -28,
      tip
    ),
    dot(0, -30, 5, BOARD),
  ];
}

/** An empty jar for notes, its lid beside it. */
export function jar(swing: number): Parts {
  return [
    flat("M-22,-22 C-28,-18 -28,26 -20,30 L20,30 C28,26 28,-18 22,-22 Z", LID),
    flat("M-17,-14 C-21,-10 -21,22 -15,25 L15,25 C21,22 21,-10 17,-14 Z", PAGE),
    box(-20, -30, 40, 9, BASE, 4),
    turned(
      [box(-9, -7, 18, 14, POP.yellow, 2)],
      0,
      14 - Math.abs(swing) * 3,
      swing * 10
    ),
    sparkle(26, -34, 4, POP.yellow),
  ];
}

/** A cup of something warm, and its steam. */
export function cup(swing: number): Parts {
  return [
    bar("M22,-22 C36,-22 36,-6 22,-6", PAGE, 5),
    flat("M-20,-30 L22,-30 L18,0 L-16,0 Z", PAGE),
    box(-20, -32, 42, 6, POP.orange, 3),
    bar(
      `M-6,-40 C-12,-48 0,-52 -6,${-62 - swing * 3} M8,-40 C2,-48 14,-52 8,${-60 + swing * 3}`,
      LID,
      3
    ),
    box(-24, 0, 50, 5, LID, 3),
  ];
}

/** A thermometer chart: a tube of marks, filled as far as the grades have come. */
export function thermometer(swing: number): Parts {
  const up = 24 + swing * 8;
  return [
    box(-9, -70, 18, 64, PAGE, 9),
    dot(0, -2, 13, PAGE),
    dot(0, -2, 9, POP.red),
    box(-4, -6 - up, 8, up + 4, POP.red, 4),
    ...Arr.makeBy(5, (tick) =>
      bar(`M12,${-16 - tick * 11} L18,${-16 - tick * 11}`, BASE, 2.5)
    ),
  ];
}

/** An abacus, a bead of each row sliding. */
export function abacus(swing: number): Parts {
  return [
    box(-40, -30, 80, 58, BOARD, 6),
    box(-33, -23, 66, 44, PAGE, 3),
    ...Arr.flatMap(
      [
        [-13, POP.red, 4],
        [-1, POP.blue, 8],
        [11, POP.green, 12],
      ] as const,
      ([y, colour, slide]) => [
        bar(`M-33,${y} L33,${y}`, BASE, 2),
        ...Arr.makeBy(4, (bead) =>
          dot(
            -24 + bead * 11 + (bead === 3 ? 14 + swing * slide : 0),
            y,
            5,
            colour
          )
        ),
      ]
    ),
  ];
}

/** A desk bell she rings, and its ring. */
export function bell(swing: number): Parts {
  return [
    box(-22, -6, 44, 7, BOARD, 3),
    flat("M-18,-6 C-18,-32 18,-32 18,-6 Z", POP.yellow),
    dot(0, -32 + Math.max(0, swing) * 3, 4.6, BASE),
    bar(
      `M24,-23 L${29 + swing * 2},-27 M25,-12 L${32 + swing * 2},-12`,
      POP.orange,
      3
    ),
  ];
}

/** A postman's bag with nothing to carry yet. */
export function satchel(swing: number): Parts {
  return [
    bar("M-30,-14 C-30,-48 30,-48 30,-14", BOARD, 5),
    box(-36, -16, 72, 46, POP.orange, 8),
    flat("M-36,-16 L36,-16 L36,2 C20,14 -20,14 -36,2 Z", BOARD),
    box(-6, 4 + swing, 12, 10, PAPER, 3),
  ];
}

/** An apple for the teacher who is not here yet. */
export function apple(swing: number): Parts {
  return [
    flat(
      "M0,-34 C-22,-46 -30,-20 -18,-4 C-10,6 -4,2 0,4 C4,2 10,6 18,-4 C30,-20 22,-46 0,-34 Z",
      POP.red
    ),
    bar("M0,-34 C0,-42 3,-46 6,-48", BOARD, 3),
    flat(
      `M4,-44 C12,-54 22,-50 ${24 + swing * 2},-44 C16,-40 10,-40 4,-44 Z`,
      POP.green
    ),
    dot(-10, -24, 3.4, PAGE),
  ];
}

/** A binder taken from the archive, and the dust she blows off it. */
export function binder(swing: number): Parts {
  return [
    box(-30, -30, 60, 60, POP.blue, 4),
    box(-30, -30, 14, 60, NINA.ink, 4),
    box(-8, -18, 30, 16, PAGE, 2),
    dot(-23, 14, 4, PAGE),
    ...Arr.map([0, 1, 2], (puff) =>
      dot(40 + puff * 9 + swing * 3, -36 - puff * 6, 5 - puff, LID)
    ),
  ];
}

/** A hook on a line that she casts. */
export function hook(swing: number): Parts {
  const x = 24 + swing * 5;
  return [
    bar(`M0,0 C8,-26 26,-22 ${x},10`, NINA.ink, 2.5),
    bar(`M${x},10 L${x},26 C${x},38 ${x - 14},38 ${x - 14},28`, BASE, 4),
    dot(x, 10, 4, POP.red),
  ];
}

/** A key card she holds out. */
export function keycard(swing: number): Parts {
  return [
    turned(
      [
        box(-24, -16, 48, 32, POP.blue, 5),
        box(-18, -8, 14, 11, POP.yellow, 2),
        bar("M2,-4 L16,-4 M2,5 L12,5", PAGE, 3),
      ],
      3,
      -20,
      -14
    ),
    bar(
      `M15,-42 C21,-48 21,-54 ${17 + swing * 2},-58 M23,-40 C31,-48 31,-58 ${25 + swing * 2},-64`,
      POP.green,
      3
    ),
  ];
}

/** A plug held out in the open hand, ready for whatever wants it. */
export function prong(swing: number): Parts {
  return [
    bar("M-4,6 C-20,30 -40,40 -60,34", NINA.ink, 3.5),
    box(-12, -24, 24, 30, POP.orange, 6),
    box(-7, -36, 5, 13, BASE, 2),
    box(2, -36, 5, 13, BASE, 2),
    sparkle(20, -44 - swing * 3, 5 + swing, POP.yellow),
  ];
}

/** An ear trumpet she listens with, and the faint sound that reaches it. */
export function trumpet(swing: number): Parts {
  return [
    turned(
      [
        flat("M0,4 L0,-4 L28,-14 L28,14 Z", POP.yellow),
        dot(28, 0, 15, POP.yellow),
        dot(28, 0, 10, BOARD),
      ],
      -8,
      -6,
      -62
    ),
    bar(
      `M-22,-44 C-26,-52 -26,-60 ${-22 + swing * 2},-68 M-8,-56 C-10,-64 -8,-72 ${-4 + swing * 2},-80`,
      LID,
      3
    ),
  ];
}

/** A fan of exam sheets she deals out, the next one leaving her hand. */
export function sheaf(swing: number): Parts {
  return [
    ...Arr.map([-34, -18, -2], (turn) =>
      turned(
        [
          box(-13, -44, 26, 36, PAGE, 3),
          bar("M-7,-34 L7,-34 M-7,-26 L3,-26", LID, 2.5),
        ],
        -4,
        0,
        turn
      )
    ),
    turned(
      [
        box(-12, -17, 24, 34, PAPER, 3),
        bar("M-6,-8 L6,-8 M-6,0 L2,0", BASE, 2.5),
      ],
      2 + swing * 6,
      -58 - swing * 4,
      20
    ),
  ];
}

/** An answer sheet: rows of circles, some filled in. */
export function bubbles(swing: number): Parts {
  const done = swing > 0 ? 3 : 2;
  return [
    box(-32, -34, 64, 64, PAGE, 4),
    ...Arr.flatMap([0, 1, 2, 3], (row) =>
      Arr.makeBy(4, (choice) =>
        dot(
          -20 + choice * 13,
          -22 + row * 14,
          4.6,
          row < done && choice === (row * 3 + 1) % 4 ? NINA.ink : LID
        )
      )
    ),
  ];
}

/** A diploma tube, its cap off, with nothing in it yet. */
export function tube(swing: number): Parts {
  return [
    turned(
      [
        box(-9, -50, 18, 54, POP.blue, 5),
        box(-9, -50, 18, 8, NINA.ink, 4),
        box(-9, -8, 18, 6, POP.yellow, 2),
      ],
      0,
      0,
      16
    ),
    turned(
      [box(-10, -8, 20, 12, POP.yellow, 5)],
      -10 + swing * 3,
      -70 - swing * 2,
      -24
    ),
    sparkle(16, -74, 4 + swing, POP.yellow),
  ];
}
