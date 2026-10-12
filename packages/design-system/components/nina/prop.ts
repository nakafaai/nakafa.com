import { n1 } from "@repo/design-system/components/nina/body";
import {
  BASE,
  BOARD,
  BODY,
  FACE,
  INK,
  LID,
  PAGE,
  PAPER,
  PINK,
  POP,
} from "@repo/design-system/components/nina/color";
import { sparkle } from "@repo/design-system/components/nina/mark";
import {
  circle,
  group,
  path,
  rect,
} from "@repo/design-system/components/nina/shape";
import { Array as Arr } from "effect";

/** A place in her figure, as x and y. */
type Place = readonly [number, number];

/** The notepad she writes on leans a little. Points on it are turned with it. */
const PAD_TURN = -4;

/**
 * An open book seen from behind, as she holds it. `turn` from 0 to 1 is one
 * page going over.
 */
export function book(turn: number) {
  // The page stands up from the spine, bends, and comes down on the other side.
  const swing = Math.cos(turn * Math.PI);
  const rise = Math.sin(turn * Math.PI);
  const page =
    turn > 0 && turn < 1
      ? [
          path({
            d: `M102,163 Q${n1(102 + 30 * swing)},${n1(162 - 34 * rise)} ${n1(102 + 46 * swing)},${n1(158 - 30 * rise)}`,
            fill: "none",
            stroke: PAPER,
            strokeLinecap: "round",
            strokeWidth: 7,
          }),
        ]
      : [];
  return [
    path({
      d: "M52,154 L102,160 L152,154 L152,160 L102,166 L52,160 Z",
      fill: PAPER,
    }),
    ...page,
    path({ d: "M50,158 L102,164 L102,214 L50,206 Z", fill: POP.orange }),
    path({ d: "M154,158 L102,164 L102,214 L154,206 Z", fill: POP.orange }),
    path({
      d: "M102,165 L102,213",
      stroke: INK,
      strokeLinecap: "round",
      strokeOpacity: 0.28,
      strokeWidth: 3,
    }),
    sparkle(128, 187, 7, PAGE),
  ];
}

/** A padlock she holds in front of her. `open` from 0 (shut) to 1 lifts its shackle out of the body. */
export function lock(open: number) {
  const up = open * 11;
  return [
    path({
      d: `M82,${n1(176 - up)} V${n1(160 - up)} C82,136 122,136 122,${n1(160 - up)}${open > 0.5 ? "" : ` V${n1(176 - up)}`}`,
      fill: "none",
      stroke: BASE,
      strokeLinecap: "round",
      strokeWidth: 9,
    }),
    rect({ fill: POP.yellow, height: 50, rx: 12, width: 76, x: 64, y: 170 }),
    circle({ cx: 102, cy: 190, fill: INK, r: 6.5 }),
    path({
      d: "M102,190 L102,204",
      stroke: INK,
      strokeLinecap: "round",
      strokeWidth: 6,
    }),
  ];
}

/** A keyboard in front of her. `down` lists the keys that are pressed right now, as [row, column]. */
export function keyboard(down: readonly Place[]) {
  const keys = Arr.flatMap(Arr.range(0, 2), (row) =>
    Arr.map(Arr.range(0, 8), (col) =>
      rect({
        fill: Arr.some(down, ([r, c]) => r === row && c === col)
          ? POP.yellow
          : BASE,
        height: 8,
        rx: 2.5,
        width: 11,
        x: 35 + col * 15 + row * 2,
        y: 227 + row * 12,
      })
    )
  );
  return [
    rect({ fill: LID, height: 46, rx: 10, width: 152, x: 26, y: 218 }),
    ...keys,
  ];
}

/** Where a point on the notepad is once the notepad leans. */
export function onPad(x: number, y: number): Place {
  const a = (PAD_TURN * Math.PI) / 180;
  const dx = x - 90;
  const dy = y - 186;
  return [
    90 + dx * Math.cos(a) - dy * Math.sin(a),
    186 + dx * Math.sin(a) + dy * Math.cos(a),
  ];
}

/** A notepad with the lines she has written so far. `ink` counts lines, with a fraction for the one in progress. */
export function pad(written: number) {
  const lines = Arr.flatMap(Arr.range(0, 2), (i) => {
    const part = Math.max(0, Math.min(1, written - i));
    return part > 0
      ? [
          path({
            d: `M70,${176 + i * 13} L${n1(70 + 40 * part)},${176 + i * 13}`,
            stroke: INK,
            strokeLinecap: "round",
            strokeWidth: 4,
          }),
        ]
      : [];
  });
  return [
    group(
      [
        rect({ fill: BOARD, height: 68, rx: 7, width: 68, x: 56, y: 152 }),
        rect({ fill: PAGE, height: 52, rx: 3, width: 56, x: 62, y: 162 }),
        rect({ fill: BASE, height: 10, rx: 3, width: 24, x: 78, y: 147 }),
        ...lines,
      ],
      { transform: `rotate(${PAD_TURN} 90 186)` }
    ),
  ];
}

/** A pencil whose point is at x, y. */
export function pencil(x: number, y: number) {
  return [
    group(
      [
        path({ d: "M0,0 L4,-9 L-4,-9 Z", fill: INK }),
        rect({ fill: POP.yellow, height: 29, width: 8, x: -4, y: -38 }),
        rect({ fill: PINK, height: 7, rx: 2, width: 8, x: -4, y: -44 }),
      ],
      { transform: `translate(${n1(x)} ${n1(y)}) rotate(40) scale(1.3)` }
    ),
  ];
}

/** A magnifying glass whose lens is centred on x, y. */
export function lens(x: number, y: number) {
  return [
    path({
      d: `M${n1(x + 13)},${n1(y + 15)} L${n1(x + 27)},${n1(y + 36)}`,
      stroke: POP.orange,
      strokeLinecap: "round",
      strokeWidth: 10,
    }),
    circle({
      cx: n1(x),
      cy: n1(y),
      fill: FACE,
      fillOpacity: 0.7,
      r: 19,
      stroke: INK,
      strokeWidth: 6,
    }),
  ];
}

/** A thought: two small circles rising from her head to a cloud, and in the cloud three dots lit one after another. */
export function dots(t: number) {
  return [
    circle({ cx: 170, cy: 40, fill: BODY, r: 5 }),
    circle({ cx: 184, cy: 24, fill: BODY, r: 7 }),
    path({
      d: "M176,-2 C170,-14 186,-22 196,-15 C204,-25 224,-22 226,-10 C240,-10 242,6 230,10 C226,18 210,18 204,12 C194,18 174,12 176,-2 Z",
      fill: BODY,
    }),
    ...Arr.map(Arr.range(0, 2), (i) => {
      const lit = Math.max(0, Math.sin((t * 1.5 - i * 0.22) * Math.PI * 2));
      return circle({
        cx: 192 + i * 13,
        cy: n1(-3 - lit * 3),
        fill: FACE,
        r: n1(3.4 + lit * 1.2),
      });
    }),
  ];
}

/** Pieces of paper falling around her. */
export function confetti(t: number) {
  const colors = [POP.yellow, POP.orange, POP.red, POP.green, POP.blue];
  return Arr.map(Arr.range(0, 13), (i) => {
    const life = (t / 2.4 + i * 0.173) % 1;
    const x = -30 + ((i * 53) % 264) + Math.sin(life * 7 + i) * 12;
    const y = -24 + life * 250;
    const fill = colors[i % 5];
    const opacity = n1(life < 0.8 ? 1 : (1 - life) / 0.2);
    return i % 3 === 0
      ? circle({ cx: n1(x), cy: n1(y), fill, opacity, r: 4.5 })
      : rect({
          fill,
          height: 8,
          opacity,
          rx: 2,
          transform: `rotate(${n1(life * 540 + i * 40)} ${n1(x)} ${n1(y)})`,
          width: 8,
          x: n1(x - 4),
          y: n1(y - 4),
        });
  });
}

/** The letter of sleep, three times, drifting up. Drawn as strokes, not as text. */
export function sleep(t: number) {
  return Arr.map(Arr.range(0, 2), (i) => {
    const life = (t / 3 + i / 3) % 1;
    const size = 7 + life * 9;
    const x = 190 + life * 34;
    const y = 46 - life * 62;
    return path({
      d: `M${n1(x - size)},${n1(y - size)} H${n1(x + size)} L${n1(x - size)},${n1(y + size)} H${n1(x + size)}`,
      fill: "none",
      opacity: n1(Math.sin(life * Math.PI)),
      stroke: BODY,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 4.5,
    });
  });
}

/** Three balls in the air between her two arms, and where the first ball is. */
export function balls(t: number, left: Place, right: Place) {
  const colors = [POP.yellow, POP.red, POP.green];
  const flights = Arr.map(Arr.range(0, 2), (i) => {
    const u = (t / 1.5 + i / 3) % 1;
    const going = u < 0.5;
    const s = going ? u / 0.5 : (u - 0.5) / 0.5;
    const from = going ? left : right;
    const to = going ? right : left;
    return {
      fill: colors[i],
      x: from[0] + (to[0] - from[0]) * s,
      y:
        from[1] +
        (to[1] - from[1]) * s -
        (going ? 124 : 96) * 4 * s * (1 - s) -
        12,
    };
  });
  const first: Place = [flights[0].x, flights[0].y];
  return {
    first,
    // The way the balls go, as a dotted line from one arm over her head to the other.
    shapes: [
      path({
        d: `M${n1(left[0])},${n1(left[1] - 14)} Q102,-128 ${n1(right[0])},${n1(right[1] - 14)}`,
        fill: "none",
        stroke: INK,
        strokeDasharray: "1 9",
        strokeLinecap: "round",
        strokeOpacity: 0.22,
        strokeWidth: 3,
      }),
      ...Arr.map(flights, ({ fill, x, y }) =>
        circle({ cx: n1(x), cy: n1(y), fill, r: 11.5 })
      ),
    ],
  };
}
