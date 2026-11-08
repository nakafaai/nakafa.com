import { BASE, BOARD, LID, PAGE, PAPER, POP } from "@repo/mascot/color";
import { free, line } from "@repo/mascot/nina/ink";
import { at, type Place } from "@repo/mascot/nina/point";
import { tenth } from "@repo/mascot/round";
import { circle, group, path, polygon, rect } from "@repo/mascot/shape";
import { Array as Arr } from "effect";

/** How much of one row is done when `done` rows are counted with a fraction, from 0 to 1. */
function share(done: number, row: number) {
  return Math.max(0, Math.min(1, done - row));
}

/** How long each row of chalk on the board runs. */
const CHALK_ROWS = [34, 22, 28] as const;

/** Where the chalk of one row of the board has reached, `part` of the way along it. */
export function chalkAt(row: number, part: number): Place {
  return [208 + CHALK_ROWS[row] * part, 84 + row * 12];
}

/**
 * A chalkboard on its easel beside her, with the rows of chalk written so far.
 * `written` counts rows, with a fraction for the row in progress.
 */
export function chalkboard(written: number) {
  const rows = Arr.flatMap(Arr.range(0, 2), (row) => {
    const part = share(written, row);
    return part > 0
      ? [
          path({
            d: `M${at(...chalkAt(row, 0))} L${at(...chalkAt(row, part))}`,
            stroke: PAGE,
            strokeLinecap: "round",
            strokeWidth: 3.5,
          }),
        ]
      : [];
  });
  return [
    path({
      d: "M210,120 L200,276 M240,120 L250,276",
      stroke: BOARD,
      strokeLinecap: "round",
      strokeWidth: 6,
    }),
    rect({ fill: BOARD, height: 58, rx: 7, width: 52, x: 199, y: 68 }),
    rect({ fill: POP.green, height: 48, rx: 4, width: 42, x: 204, y: 73 }),
    ...rows,
  ];
}

/** A pointer stick from the tip of her arm at `from` to its point at `to`. */
export function pointer(from: Place, to: Place) {
  return [
    path({
      d: `M${at(...from)} L${at(...to)}`,
      stroke: BOARD,
      strokeLinecap: "round",
      strokeWidth: 5,
    }),
    circle({ cx: tenth(to[0]), cy: tenth(to[1]), fill: PAGE, r: 3 }),
  ];
}

/** The books of the pile she carries, from the bottom: colour, left edge and width. */
const PILE = [
  { fill: POP.blue, width: 96, x: 54 },
  { fill: POP.orange, width: 84, x: 62 },
  { fill: POP.green, width: 90, x: 56 },
] as const;

/** One book of a pile, lying flat: its cover and the edge of its pages. */
function book(fill: string, x: number, y: number, width: number) {
  return [
    rect({ fill, height: 14, rx: 3, width, x, y }),
    rect({
      fill: PAGE,
      height: 8,
      rx: 2,
      width: width - 10,
      x: x + 7,
      y: y + 3,
    }),
  ];
}

/** A pile of books she carries in front of her, the top one tipping by `tip` degrees. */
export function pile(tip: number) {
  return [
    ...Arr.flatMap(PILE, ({ fill, width, x }, i) =>
      book(fill, x, 198 - i * 15, width)
    ),
    group(book(POP.red, 64, 153, 78), {
      transform: `rotate(${tenth(tip)} 103 160)`,
    }),
  ];
}

/** The report card she holds leans a little. Places on it are turned with it. */
const CARD_TURN = -5;

/**
 * A report card she holds: its lines of marks, and the seal that grows on it
 * from nothing as `sealed` goes from 0 to 1.
 */
export function card(sealed: number) {
  const lines = Arr.map(Arr.range(0, 2), (i) =>
    path({
      d: `M70,${170 + i * 11} L${104 - i * 8},${170 + i * 11}`,
      stroke: BASE,
      strokeLinecap: "round",
      strokeWidth: 4,
    })
  );
  const seal =
    sealed > 0
      ? [
          circle({
            cx: 104,
            cy: 201,
            fill: "none",
            r: tenth(4 + 6 * sealed),
            stroke: POP.red,
            strokeWidth: 3.5,
          }),
          circle({ cx: 104, cy: 201, fill: POP.red, r: tenth(3 * sealed) }),
        ]
      : [];
  return [
    group(
      [
        rect({ fill: PAGE, height: 72, rx: 5, width: 66, x: 58, y: 156 }),
        rect({ fill: POP.blue, height: 6, rx: 2, width: 66, x: 58, y: 156 }),
        ...lines,
        ...seal,
      ],
      { transform: `rotate(${CARD_TURN} 91 192)` }
    ),
  ];
}

/** A rubber stamp whose foot stands at x, y. */
export function stamp(x: number, y: number) {
  return [
    group(
      [
        rect({ fill: POP.red, height: 9, rx: 2, width: 26, x: -13, y: -9 }),
        rect({ fill: BOARD, height: 16, rx: 3, width: 10, x: -5, y: -25 }),
        circle({ cx: 0, cy: -30, fill: POP.orange, r: 8 }),
      ],
      { transform: `translate(${tenth(x)} ${tenth(y)})` }
    ),
  ];
}

/**
 * A graduation cap between her ears, which stay in sight under its board, and
 * its tassel swung out by `swing`, from -1 to 1.
 */
export function cap(swing: number) {
  const end: Place = [140 + swing * 5, 44];
  return [
    path({
      d: "M89,31 L117,31 L115,45 C109,48 97,48 91,45 Z",
      fill: BASE,
    }),
    polygon({ fill: POP.blue, points: "62,23 103,10 144,23 103,36" }),
    path({
      d: `M103,23 L138,26 L${at(...end)}`,
      fill: "none",
      stroke: POP.yellow,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 3,
    }),
    rect({
      fill: POP.yellow,
      height: 9,
      rx: 2,
      width: 6,
      x: tenth(end[0] - 3),
      y: tenth(end[1]),
    }),
    circle({ cx: 103, cy: 23, fill: POP.yellow, r: 3 }),
  ];
}

/** A rolled diploma held by its middle at x, y, tied with a ribbon. */
export function diploma(x: number, y: number) {
  return [
    group(
      [
        rect({ fill: PAGE, height: 13, rx: 6.5, width: 46, x: -23, y: -6.5 }),
        circle({ cx: -21, cy: 0, fill: PAPER, r: 6.5 }),
        rect({ fill: POP.red, height: 13, rx: 1, width: 6, x: -3, y: -6.5 }),
      ],
      { transform: `translate(${tenth(x)} ${tenth(y)}) rotate(-24)` }
    ),
  ];
}

/** A hand bell held by its handle at x, y and swung by `swing` degrees about it, its clapper lagging behind. */
export function bell(x: number, y: number, swing: number) {
  return [
    group(
      [
        rect({ fill: BOARD, height: 20, rx: 5, width: 11, x: -5.5, y: -10 }),
        path({
          d: "M-20,40 C-19,22 -15,10 0,9 C15,10 19,22 20,40 Z",
          fill: POP.yellow,
        }),
        rect({ fill: POP.orange, height: 6, rx: 3, width: 46, x: -23, y: 38 }),
        circle({ cx: tenth(-swing * 0.15), cy: 48, fill: BASE, r: 5.5 }),
      ],
      {
        transform: `translate(${tenth(x)} ${tenth(y)}) rotate(${tenth(swing)})`,
      }
    ),
  ];
}

/** The colours of the beads, one per rod of the abacus. */
const BEAD_COLORS = [POP.red, POP.yellow, POP.green] as const;

/**
 * An abacus she holds in front of her. `moved` counts, for each rod, how many of
 * its four beads have slid across, with a fraction for the bead on its way.
 */
export function abacus(moved: readonly [number, number, number]) {
  const rods = Arr.flatMap(Arr.range(0, 2), (rod) => {
    const y = 172 + rod * 13;
    const beads = Arr.map(Arr.range(0, 3), (bead) => {
      // The beads slide from the right end to the left end, the first one first.
      const across = share(moved[rod], bead);
      const from = 140 - bead * 10;
      const to = 66 + (3 - bead) * 10;
      return circle({
        cx: tenth(from + (to - from) * across),
        cy: y,
        fill: BEAD_COLORS[rod],
        r: 5,
      });
    });
    return [
      path({
        d: `M58,${y} L146,${y}`,
        stroke: BASE,
        strokeLinecap: "round",
        strokeWidth: 2.5,
      }),
      ...beads,
    ];
  });
  return [
    rect({ fill: BOARD, height: 52, rx: 7, width: 104, x: 50, y: 160 }),
    rect({ fill: LID, height: 42, rx: 4, width: 94, x: 55, y: 165 }),
    ...rods,
  ];
}

/** The ring of a bell: three short lines that stand free beside it, on the side it swings toward. */
export function ring(x: number, y: number, toward: number) {
  const side = toward < 0 ? -1 : 1;
  return Arr.map([-1, 0, 1], (row) =>
    free(line([x + side * 4, y + row * 10], [x + side * 12, y + row * 13]))
  );
}
