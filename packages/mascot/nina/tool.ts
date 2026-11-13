import { BASE, BOARD, LID, NINA, PAGE, PAPER, POP } from "@repo/mascot/color";
import { free, line } from "@repo/mascot/nina/ink";
import { at, type Place } from "@repo/mascot/nina/point";
import { tenth } from "@repo/mascot/round";
import { circle, group, path, polygon, rect } from "@repo/mascot/shape";
import { sparkle } from "@repo/mascot/sparkle";
import { Array as Arr } from "effect";

/** How far along a round `part` is between `from` and `to`, from 0 to 1. */
function within(part: number, from: number, to: number) {
  return Math.max(0, Math.min(1, (part - from) / (to - from)));
}

/** A star of five points, centred on x, y, `r` across its points. */
function starAt(x: number, y: number, r: number, fill: string) {
  const points = Arr.map(Arr.range(0, 9), (i) => {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const reach = i % 2 === 0 ? r : r * 0.45;
    return `${tenth(x + Math.cos(angle) * reach)},${tenth(y + Math.sin(angle) * reach)}`;
  });
  return polygon({ fill, points: Arr.join(points, " ") });
}

/** A star held up on a short stick at x, y, turned by `turn` degrees, and the stars it leaves beside it. */
export function wand(x: number, y: number, turn: number, twinkle: number) {
  return [
    group(
      [
        path({
          d: "M0,0 L0,-22",
          stroke: BOARD,
          strokeLinecap: "round",
          strokeWidth: 5,
        }),
        starAt(0, -34, 17, POP.yellow),
      ],
      {
        transform: `translate(${tenth(x)} ${tenth(y)}) rotate(${tenth(turn)})`,
      }
    ),
    sparkle(x - 34, y - 46 + twinkle * 4, 5 + twinkle * 2, POP.yellow),
    sparkle(x + 24, y - 6 - twinkle * 3, 4, POP.orange),
  ];
}

/** A watering can held by its handle at x, y, tipped by `tip` degrees, and the drops it pours. */
export function can(x: number, y: number, tip: number, t: number) {
  const drops = Arr.map(Arr.range(0, 2), (i) => {
    const fall = (t * 1.6 + i / 3) % 1;
    return circle({
      cx: tenth(x + 44 - i * 4),
      cy: tenth(y + 26 + fall * 60),
      fill: POP.blue,
      opacity: tenth(1 - fall * 0.7),
      r: 3,
    });
  });
  return [
    group(
      [
        path({
          d: "M14,6 L40,-6",
          stroke: POP.green,
          strokeLinecap: "round",
          strokeWidth: 6,
        }),
        rect({ fill: POP.green, height: 26, rx: 6, width: 30, x: -12, y: 0 }),
        path({
          d: "M-10,2 C-10,-14 14,-14 14,2",
          fill: "none",
          stroke: POP.green,
          strokeLinecap: "round",
          strokeWidth: 4,
        }),
      ],
      { transform: `translate(${tenth(x)} ${tenth(y)}) rotate(${tenth(tip)})` }
    ),
    ...(tip > 8 ? drops : []),
  ];
}

/** A sprout in its pot on the floor beside her, grown by `grown`, from 0 to 1. */
export function sprout(grown: number) {
  const top = 238 - grown * 26;
  return [
    path({
      d: `M232,256 L${at(232, top)}`,
      stroke: POP.green,
      strokeLinecap: "round",
      strokeWidth: 4,
    }),
    path({
      d: `M${at(232, top + 6)} C${at(220, top - 4)} ${at(214, top + 8)} ${at(222, top + 14)} Z`,
      fill: POP.green,
    }),
    path({
      d: `M${at(232, top + 2)} C${at(244, top - 8)} ${at(250, top + 4)} ${at(242, top + 10)} Z`,
      fill: POP.green,
    }),
    path({ d: "M216,252 L248,252 L243,276 L221,276 Z", fill: POP.orange }),
  ];
}

/** A fishing rod from her hand at x, y to its tip, its line, and a float that bobs on the water. */
export function rod(x: number, y: number, bob: number) {
  const tip: Place = [x + 20, y - 92];
  const float: Place = [tip[0] + 2, 236 + bob * 4];
  return [
    path({
      d: `M${at(x, y)} L${at(...tip)}`,
      stroke: BOARD,
      strokeLinecap: "round",
      strokeWidth: 5,
    }),
    path({
      d: `M${at(...tip)} L${at(...float)}`,
      stroke: NINA.ink,
      strokeOpacity: 0.5,
      strokeWidth: 1.5,
    }),
    path({
      d: "M196,250 Q210,244 224,250 T252,250",
      fill: "none",
      stroke: POP.blue,
      strokeLinecap: "round",
      strokeWidth: 3,
    }),
    circle({ cx: tenth(float[0]), cy: tenth(float[1]), fill: POP.red, r: 6 }),
    path({
      d: `M${at(float[0] - 6, float[1])} A6,6 0 0 0 ${at(float[0] + 6, float[1])} Z`,
      fill: PAGE,
    }),
  ];
}

/** A broom held at x, y, its bristles on the floor, swept by `swing`, and the dust it lifts. */
export function broom(x: number, y: number, swing: number) {
  const foot: Place = [x + 26 + swing * 10, 266];
  const puffs = Math.abs(swing) > 0.6 ? 1 : 0;
  return [
    path({
      d: `M${at(x, y)} L${at(...foot)}`,
      stroke: BOARD,
      strokeLinecap: "round",
      strokeWidth: 5,
    }),
    path({
      d: `M${at(foot[0] - 14, foot[1] + 16)} L${at(foot[0] - 6, foot[1] - 2)} L${at(foot[0] + 8, foot[1] - 2)} L${at(foot[0] + 16, foot[1] + 16)} Z`,
      fill: POP.yellow,
    }),
    ...Arr.map(Arr.range(0, 2 * puffs), (i) =>
      circle({
        cx: tenth(foot[0] + (swing > 0 ? 24 : -24) + i * 6),
        cy: tenth(276 - i * 7),
        fill: LID,
        r: 4 - i,
      })
    ),
  ];
}

/**
 * An envelope she holds in front of her, its flap opened by `open`, from 0 to 1,
 * and a letter that rises out of it as it opens.
 */
export function envelope(open: number) {
  const flap = 166 - open * 22;
  return [
    rect({ fill: PAPER, height: 48, rx: 4, width: 84, x: 60, y: 166 }),
    rect({
      fill: PAGE,
      height: 30,
      rx: 2,
      width: 66,
      x: 69,
      y: tenth(170 - open * 18),
    }),
    path({ d: "M60,170 L102,196 L144,170 L144,214 L60,214 Z", fill: PAPER }),
    path({
      d: `M60,166 L102,${tenth(flap + 22)} L144,166 Z`,
      fill: open > 0.5 ? PAPER : POP.orange,
    }),
    circle({ cx: 102, cy: 196, fill: POP.red, r: 5 }),
  ];
}

/** A clipboard she holds in front of her, with `ticked` of its three rows ticked, with a fraction for the row in progress. */
export function clipboard(ticked: number) {
  const rows = Arr.flatMap(Arr.range(0, 2), (row) => {
    const y = 176 + row * 14;
    const done = within(ticked, row, row + 1);
    return [
      rect({ fill: LID, height: 8, rx: 2, width: 8, x: 72, y: y - 4 }),
      path({
        d: `M88,${y} L128,${y}`,
        stroke: BASE,
        strokeLinecap: "round",
        strokeWidth: 3,
      }),
      ...(done > 0.5
        ? [
            path({
              d: `M71,${y - 1} L75,${y + 3} L83,${y - 7}`,
              fill: "none",
              stroke: POP.green,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 3,
            }),
          ]
        : []),
    ];
  });
  return [
    rect({ fill: BOARD, height: 66, rx: 6, width: 76, x: 64, y: 158 }),
    rect({ fill: PAGE, height: 54, rx: 3, width: 66, x: 69, y: 166 }),
    rect({ fill: BASE, height: 9, rx: 3, width: 26, x: 89, y: 154 }),
    ...rows,
  ];
}

/** A cardboard box she holds in front of her, its two flaps opened by `open`, from 0 to 1. */
export function box(open: number) {
  const lift = open * 16;
  return [
    rect({ fill: BOARD, height: 46, rx: 3, width: 84, x: 60, y: 172 }),
    path({
      d: `M60,172 L${at(54, 166 - lift)} L${at(98, 166 - lift)} L102,172 Z`,
      fill: PAPER,
    }),
    path({
      d: `M102,172 L${at(106, 166 - lift)} L${at(150, 166 - lift)} L144,172 Z`,
      fill: PAPER,
    }),
    path({
      d: "M78,196 L126,196",
      stroke: PAPER,
      strokeLinecap: "round",
      strokeWidth: 4,
    }),
  ];
}

/** A folder she holds in front of her, and a page that slides into it, `in` of the way, from 0 to 1. */
export function folder(slid: number) {
  return [
    path({
      d: "M58,170 L58,218 L146,218 L146,174 L98,174 L90,166 L64,166 Z",
      fill: POP.blue,
    }),
    rect({
      fill: PAGE,
      height: 40,
      rx: 2,
      width: 64,
      x: 70,
      y: tenth(146 + slid * 26),
    }),
    path({ d: "M58,182 L146,182 L146,218 L58,218 Z", fill: POP.blue }),
    path({
      d: "M84,198 L120,198",
      stroke: PAGE,
      strokeLinecap: "round",
      strokeOpacity: 0.6,
      strokeWidth: 3,
    }),
  ];
}

/** A board she holds in front of her, with three bars grown by `grown`, each a little after the one before. */
export function chart(grown: number) {
  const colors = [POP.green, POP.yellow, POP.orange] as const;
  const bars = Arr.map(Arr.range(0, 2), (i) => {
    const height = (14 + i * 10) * within(grown, i * 0.25, 0.5 + i * 0.25);
    return rect({
      fill: colors[i],
      height: tenth(height),
      rx: 2,
      width: 14,
      x: 76 + i * 20,
      y: tenth(210 - height),
    });
  });
  return [
    rect({ fill: BOARD, height: 60, rx: 6, width: 84, x: 60, y: 160 }),
    rect({ fill: PAGE, height: 50, rx: 3, width: 74, x: 65, y: 165 }),
    path({
      d: "M72,210 L134,210",
      stroke: BASE,
      strokeLinecap: "round",
      strokeWidth: 2,
    }),
    ...bars,
  ];
}

/** A ballot box on the floor beside her, and a card held at x, y on its way into its slot. */
export function ballot(x: number, y: number, dropped: number) {
  return [
    rect({ fill: POP.blue, height: 50, rx: 5, width: 58, x: 186, y: 226 }),
    rect({ fill: NINA.ink, height: 4, rx: 2, width: 26, x: 202, y: 230 }),
    path({
      d: "M206,250 L214,258 L228,242",
      fill: "none",
      stroke: PAGE,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 4,
    }),
    ...(dropped < 1
      ? [
          rect({
            fill: PAGE,
            height: 22,
            rx: 2,
            transform: `rotate(-8 ${tenth(x)} ${tenth(y)})`,
            width: 16,
            x: tenth(x - 8),
            y: tenth(y - 4),
          }),
        ]
      : []),
  ];
}

/** An easel beside her, and on its canvas the strokes of colour painted so far, with a fraction for the one in progress. */
export function easel(painted: number) {
  const strokes = [
    { colour: POP.red, d: "M208,80 C216,72 228,88 238,78" },
    { colour: POP.yellow, d: "M206,96 C218,90 226,104 240,94" },
    { colour: POP.green, d: "M210,112 C220,106 230,118 236,110" },
  ] as const;
  return [
    path({
      d: "M210,120 L200,276 M240,120 L250,276 M225,124 L225,268",
      stroke: BOARD,
      strokeLinecap: "round",
      strokeWidth: 6,
    }),
    rect({ fill: PAGE, height: 60, rx: 4, width: 50, x: 200, y: 66 }),
    ...Arr.flatMap(Arr.range(0, 2), (i) =>
      within(painted, i, i + 1) > 0
        ? [
            path({
              d: strokes[i].d,
              fill: "none",
              pathLength: 1,
              stroke: strokes[i].colour,
              strokeDasharray: `${tenth(within(painted, i, i + 1))} 1`,
              strokeLinecap: "round",
              strokeWidth: 5,
            }),
          ]
        : []
    ),
  ];
}

/** A paintbrush from her hand at `from` to its tip at `to`, dipped in `colour`. */
export function brush(from: Place, to: Place, colour: string) {
  return [
    path({
      d: `M${at(...from)} L${at(...to)}`,
      stroke: BOARD,
      strokeLinecap: "round",
      strokeWidth: 5,
    }),
    circle({ cx: tenth(to[0]), cy: tenth(to[1]), fill: colour, r: 4.5 }),
  ];
}

/** A camera she holds up in front of her, and its flash, lit by `flash`, from 0 to 1. */
export function camera(flash: number) {
  return [
    rect({ fill: NINA.ink, height: 40, rx: 8, width: 72, x: 66, y: 164 }),
    rect({ fill: BASE, height: 8, rx: 2, width: 18, x: 72, y: 158 }),
    circle({ cx: 102, cy: 184, fill: LID, r: 14 }),
    circle({ cx: 102, cy: 184, fill: POP.blue, r: 8 }),
    circle({ cx: 98, cy: 180, fill: PAGE, r: 2.5 }),
    rect({ fill: POP.yellow, height: 6, rx: 2, width: 10, x: 122, y: 168 }),
    ...(flash > 0.5
      ? [
          free(line([138, 154], [148, 144])),
          free(line([142, 166], [154, 166])),
          free(line([138, 178], [148, 188])),
        ]
      : []),
  ];
}

/** Two speech bubbles over her, the first and then the second, as a chat goes back and forth. */
export function bubbles(turn: number) {
  const first = within(turn, 0, 0.15) * (1 - within(turn, 0.85, 1));
  const second = within(turn, 0.35, 0.5) * (1 - within(turn, 0.85, 1));
  return [
    group(
      [
        path({
          d: "M164,-4 L224,-4 Q234,-4 234,6 L234,26 Q234,36 224,36 L184,36 L172,48 L174,36 L164,36 Q154,36 154,26 L154,6 Q154,-4 164,-4 Z",
          fill: POP.blue,
        }),
        ...Arr.map(Arr.range(0, 2), (i) =>
          circle({ cx: 178 + i * 16, cy: 16, fill: PAGE, r: 3.5 })
        ),
      ],
      { opacity: tenth(first) }
    ),
    group(
      [
        path({
          d: "M-36,24 L14,24 Q24,24 24,34 L24,50 Q24,60 14,60 L-6,60 L-16,70 L-14,60 L-36,60 Q-46,60 -46,50 L-46,34 Q-46,24 -36,24 Z",
          fill: POP.green,
        }),
        path({
          d: "M-30,42 L8,42",
          stroke: PAGE,
          strokeLinecap: "round",
          strokeWidth: 4,
        }),
      ],
      { opacity: tenth(second) }
    ),
  ];
}

/** A plug held at x, y on its cable, and the socket on the wall beside her that it goes into. */
export function plug(x: number, y: number, home: number) {
  return [
    rect({ fill: PAGE, height: 44, rx: 8, width: 30, x: 220, y: 116 }),
    rect({ fill: NINA.ink, height: 10, rx: 2, width: 4, x: 228, y: 133 }),
    rect({ fill: NINA.ink, height: 10, rx: 2, width: 4, x: 238, y: 133 }),
    path({
      d: `M${at(x - 10, y + 4)} C${at(x - 30, y + 30)} 170,270 140,276`,
      fill: "none",
      stroke: NINA.ink,
      strokeLinecap: "round",
      strokeWidth: 3,
    }),
    group(
      [
        rect({ fill: POP.orange, height: 18, rx: 4, width: 22, x: -11, y: -9 }),
        rect({ fill: BASE, height: 4, rx: 1, width: 9, x: 11, y: -6 }),
        rect({ fill: BASE, height: 4, rx: 1, width: 9, x: 11, y: 2 }),
      ],
      { transform: `translate(${tenth(x)} ${tenth(y)})` }
    ),
    ...(home > 0.5 ? [sparkle(244, 104, 6, POP.yellow)] : []),
  ];
}
