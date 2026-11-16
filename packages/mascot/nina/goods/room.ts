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

/** A closed door she knocks on, and the knocks. */
export function door(swing: number): Parts {
  return [
    box(-24, -112, 44, 112, BOARD, 4),
    box(-18, -104, 32, 40, PAPER, 3),
    box(-18, -56, 32, 44, PAPER, 3),
    dot(12, -52, 3.6, NINA.ink),
    bar(
      `M-34,${-88 - swing * 2} L-40,${-92 - swing * 2} M-34,-78 L-42,-78`,
      BASE,
      3
    ),
  ];
}

/** A door left ajar, and the light that falls through the gap. */
export function ajar(swing: number): Parts {
  const open = 10 + swing * 4;
  return [
    box(-24, -112, 44, 112, NINA.ink, 4),
    flat(`M-24,-112 L${-24 + open},-112 L${-24 + open},0 L-24,0 Z`, POP.yellow),
    flat(`M${-24 + open},-112 L20,-106 L20,-6 L${-24 + open},0 Z`, BOARD),
    dot(12, -54, 3.6, PAGE),
  ];
}

/** A desk and its chair, set out for a room that is not there yet. */
export function desks(swing: number): Parts {
  return [
    box(-26, -46, 46, 8, BOARD, 3),
    bar("M-20,-38 L-20,0 M14,-38 L14,0", BASE, 5),
    box(-14, -60 - Math.max(0, swing) * 3, 22, 14, PAGE, 2),
    box(-12, -22, 18, 6, POP.blue, 3),
    bar("M-9,-16 L-9,0 M3,-16 L3,0", LID, 4),
  ];
}

/** A closed shutter with its sign, and the place in line she keeps. */
export function shutter(swing: number): Parts {
  return [
    box(-24, -110, 44, 110, LID, 4),
    ...Arr.makeBy(8, (slat) =>
      bar(`M-20,${-96 + slat * 12} L16,${-96 + slat * 12}`, BASE, 2.5)
    ),
    turned(
      [box(-13, -8, 26, 16, POP.red, 3), bar("M-6,0 L6,0", PAGE, 3)],
      -2,
      -58,
      swing * 6
    ),
    box(-8, -8, 12, 8, BASE, 3),
  ];
}

/** Two empty chairs, set side by side. */
export function chairs(swing: number): Parts {
  return [
    ...Arr.flatMap(
      [
        [-13, 0, POP.blue],
        [9, 4, POP.orange],
      ] as const,
      ([x, back, colour]) => [
        box(x - 9, -52 - back, 18, 30, colour, 4),
        box(x - 10, -24 - back, 20, 7, BOARD, 3),
        bar(
          `M${x - 7},${-17 - back} L${x - 7},0 M${x + 7},${-17 - back} L${x + 7},0`,
          BASE,
          4
        ),
      ]
    ),
    sparkle(-2, -70 - swing * 3, 4, POP.yellow),
  ];
}

/** A tall pile of empty report covers. */
export function pile(swing: number): Parts {
  return Arr.map(
    [POP.blue, POP.green, POP.red, POP.yellow, POP.blue, POP.green, POP.red],
    (colour, cover) =>
      box(
        -22 + (cover % 2) * 3 + (cover === 6 ? swing * 3 : 0),
        -12 - cover * 11,
        40,
        10,
        colour,
        3
      )
  );
}

/** A pinboard on a post, and the note she pins to it. */
export function pinboard(swing: number): Parts {
  return [
    bar("M-2,-50 L-2,0 M-14,0 L10,0", BASE, 5),
    box(-25, -116, 46, 62, BOARD, 5),
    box(-19, -110, 16, 16, POP.yellow, 2),
    box(1, -106, 14, 18, PAGE, 2),
    turned(
      [box(-9, -9, 18, 18, POP.blue, 2), dot(0, -5, 3, POP.red)],
      -8,
      -72,
      swing * 8
    ),
    dot(-11, -106, 2.6, POP.red),
    dot(8, -102, 2.6, POP.green),
  ];
}

/** A letterbox on its post, its flag down: nothing has come yet. */
export function letterbox(swing: number): Parts {
  return [
    bar("M-2,-58 L-2,0", BOARD, 7),
    turned(
      [bar("M0,0 L0,-18", BASE, 3), box(-11, -20, 11, 8, POP.red, 2)],
      -22,
      -70,
      -70 - swing * 12
    ),
    flat("M-24,-64 L-24,-82 C-24,-100 18,-100 18,-82 L18,-64 Z", POP.blue),
    box(-24, -70, 42, 10, POP.blue, 3),
    box(-14, -84, 24, 5, NINA.ink, 2),
  ];
}

/** A small one of her kind, who walks beside her. */
export function small(swing: number): Parts {
  return [
    bar(
      `M-10,-10 C-16,-2 -20,${4 + swing * 2} -22,0 M0,-8 L0,2 M10,-10 C16,-2 20,${4 - swing * 2} 22,0`,
      NINA.body,
      8
    ),
    flat(
      "M-14,-14 C-18,-40 -8,-46 0,-46 C8,-46 18,-40 14,-14 C8,-6 -8,-6 -14,-14 Z",
      NINA.body
    ),
    flat(
      "M-22,-52 C-22,-64 -10,-66 0,-62 C10,-66 22,-64 22,-52 C22,-42 12,-40 0,-42 C-12,-40 -22,-42 -22,-52 Z",
      NINA.body
    ),
    flat(
      "M-17,-52 C-17,-60 -8,-60 0,-57 C8,-60 17,-60 17,-52 C17,-46 8,-45 0,-46 C-8,-45 -17,-46 -17,-52 Z",
      NINA.face
    ),
    dot(-12, -53, 2.4, NINA.ink),
    dot(12, -53, 2.4, NINA.ink),
    bar("M-3,-49 C-1,-47 1,-47 3,-49", NINA.ink, 2),
    bar(`M-12,-30 C-24,-34 -30,-44 -${34 + swing * 2},-52`, NINA.body, 7),
  ];
}

/** A height chart on the wall, and the mark of how tall she was last time. */
export function height(swing: number): Parts {
  return [
    box(-12, -116, 28, 116, PAGE, 4),
    ...Arr.makeBy(10, (tick) =>
      bar(
        `M16,${-10 - tick * 11} L${tick % 2 === 0 ? 2 : 8},${-10 - tick * 11}`,
        BASE,
        2.5
      )
    ),
    flat(
      `M-12,${-88 - swing * 4} L-26,${-96 - swing * 4} L-26,${-80 - swing * 4} Z`,
      POP.red
    ),
    bar("M-8,-66 L12,-66", POP.blue, 3),
  ];
}

/** An open doorway with a mat, for whoever comes first. */
export function doorway(swing: number): Parts {
  return [
    box(-24, -114, 44, 114, POP.yellow, 4),
    flat("M-24,-114 L-8,-104 L-8,-8 L-24,0 Z", BOARD),
    dot(-12, -56, 3, NINA.ink),
    box(-22, -4, 42, 6, POP.red, 3),
    sparkle(6, -70 - swing * 4, 6, PAGE),
  ];
}

/** A row of coat hooks on a post, every one of them empty but the last. */
export function hooks(swing: number): Parts {
  return [
    bar("M-2,-116 L-2,0 M-14,0 L10,0", BOARD, 6),
    ...Arr.map([-104, -84, -64], (y) =>
      bar(
        `M-2,${y} C6,${y} 12,${y - 2} 12,${y - 10} M-2,${y} C-10,${y} -16,${y - 2} -16,${y - 10}`,
        BASE,
        4
      )
    ),
    turned(
      [
        flat("M-4,0 L4,0 L9,34 L-9,34 Z", POP.red),
        bar("M-9,34 L9,34", POP.yellow, 4),
      ],
      -16,
      -74,
      swing * 6
    ),
  ];
}

/** A hat stand with three hats that nobody wears yet. */
export function rack(swing: number): Parts {
  return [
    bar("M-2,-112 L-2,0 M-16,0 L12,0", BOARD, 6),
    bar("M-18,-96 L12,-96 M-14,-66 L8,-66", BOARD, 4),
    turned(
      [
        flat("M-10,0 C-10,-14 10,-14 10,0 Z", POP.blue),
        bar("M-13,0 L13,0", POP.blue, 4),
      ],
      -18,
      -98,
      -10 + swing * 5
    ),
    turned(
      [
        flat("M-8,0 L-7,-14 L7,-14 L8,0 Z", POP.red),
        bar("M-12,0 L12,0", POP.red, 4),
      ],
      8,
      -98,
      8 - swing * 5
    ),
    turned(
      [
        flat("M-10,0 C-10,-16 10,-16 10,0 Z", POP.yellow),
        bar("M-10,0 L15,0", POP.orange, 4),
      ],
      -12,
      -68,
      -6
    ),
  ];
}

/** Chairs stacked one on another, the top one still settling. */
export function stack(swing: number): Parts {
  return [
    bar("M-16,-8 L-16,0 M12,-8 L12,0", BASE, 4),
    ...Arr.map([POP.blue, POP.orange, POP.green, POP.red], (colour, chair) =>
      turned(
        [box(-18, -8, 34, 7, colour, 3), bar("M-16,-8 L-20,-30", colour, 5)],
        chair * 2,
        -4 - chair * 14,
        chair === 3 ? swing * 5 : 0
      )
    ),
  ];
}
