import { n1 } from "@repo/design-system/components/nina/body";
import {
  BODY,
  FACE,
  INK,
  PINK,
  POP,
} from "@repo/design-system/components/nina/color";
import { ink, sparkle } from "@repo/design-system/components/nina/mark";
import {
  circle,
  ellipse,
  group,
  path,
  type Shape,
} from "@repo/design-system/components/nina/shape";
import { Array as Arr, Schema } from "effect";

/** Her faces. `paham` is `senang` with a sparkle: the moment she gets it. */
export const MoodSchema = Schema.Literals([
  "halo",
  "senang",
  "paham",
  "tenang",
  "tanya",
  "mikir",
  "fokus",
  "kaget",
  "bingung",
  "sedih",
  "bangga",
  "kedip",
  "tertawa",
  "malu",
  "tidur",
]);

/** Where her eyes look, as a small offset from straight ahead. */
export const LookSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);

export type Look = typeof LookSchema.Type;

const EyeSchema = Schema.Literals([
  "arc",
  "aside",
  "big",
  "brow",
  "dot",
  "set",
  "shut",
  "small",
  "tight",
  "up",
  "worried",
]);

const MouthSchema = Schema.Literals([
  "cat",
  "flat",
  "frown",
  "gasp",
  "grin",
  "hm",
  "laugh",
  "oh",
  "small",
  "smile",
  "smirk",
  "tongue",
  "wave",
]);

const ExtraSchema = Schema.Literals([
  "blush",
  "marks",
  "none",
  "sparkle",
  "swirl",
  "tear",
  "thought",
  "zed",
]);

/** What each face is made of: left eye, right eye, mouth and what goes with them. */
const FACES = {
  halo: ["dot", "dot", "smile", "none"],
  senang: ["arc", "arc", "grin", "none"],
  paham: ["arc", "arc", "grin", "sparkle"],
  tenang: ["dot", "dot", "small", "none"],
  tanya: ["dot", "brow", "oh", "none"],
  mikir: ["up", "up", "hm", "thought"],
  fokus: ["set", "set", "tongue", "none"],
  kaget: ["big", "big", "gasp", "marks"],
  bingung: ["dot", "small", "wave", "swirl"],
  sedih: ["worried", "worried", "frown", "tear"],
  bangga: ["arc", "arc", "cat", "none"],
  kedip: ["dot", "arc", "smirk", "none"],
  tertawa: ["tight", "tight", "laugh", "none"],
  malu: ["aside", "aside", "small", "blush"],
  tidur: ["shut", "shut", "flat", "zed"],
} satisfies Record<
  typeof MoodSchema.Type,
  readonly [
    typeof EyeSchema.Type,
    typeof EyeSchema.Type,
    typeof MouthSchema.Type,
    typeof ExtraSchema.Type,
  ]
>;

/** An open eye: it blinks. */
function open(cx: number, cy: number, rx: number, ry: number) {
  return ellipse({ cx: n1(cx), cy: n1(cy), eye: true, fill: INK, rx, ry });
}

/** A line of ink from one point to the next. */
function line(...points: readonly (readonly [number, number])[]) {
  return Arr.join(
    Arr.map(
      points,
      ([x, y], index) => `${index === 0 ? "M" : "L"}${n1(x)},${n1(y)}`
    ),
    " "
  );
}

/** An eye at x, y. `side` is -1 for her left eye and 1 for her right. */
const EYES = {
  arc: (x, y) => [
    ink(
      `M${n1(x - 7)},${n1(y + 3)} Q${n1(x)},${n1(y - 8)} ${n1(x + 7)},${n1(y + 3)}`
    ),
  ],
  // Glancing aside and down, the way shy people look.
  aside: (x, y) => [open(x - 3, y + 3, 5.6, 6.8)],
  big: (x, y) => [
    open(x, y, 8.6, 10.4),
    circle({ cx: n1(x - 2.6), cy: n1(y - 3.6), fill: FACE, r: 2.6 }),
  ],
  // Asking: the eye under one raised brow.
  brow: (x, y) => [
    open(x, y - 1, 6.6, 8),
    ink(
      `M${n1(x - 9)},${n1(y - 17)} Q${n1(x)},${n1(y - 23)} ${n1(x + 9)},${n1(y - 17)}`,
      4
    ),
  ],
  dot: (x, y) => [open(x, y, 6.6, 8)],
  // Set on something: the eye under a lid that slopes down toward the middle of her face.
  set: (x, y, side) => [
    open(x, y + 1, 6.6, 7.6),
    path({
      d: `M${n1(x + side * 11)},${n1(y - 12)} L${n1(x - side * 11)},${n1(y - 3)} L${n1(x - side * 11)},${n1(y - 12)} Z`,
      fill: FACE,
    }),
    ink(line([x + side * 10, y - 10], [x - side * 10, y - 3]), 4.5),
  ],
  shut: (x, y) => [
    ink(
      `M${n1(x - 7)},${n1(y - 1)} Q${n1(x)},${n1(y + 7)} ${n1(x + 7)},${n1(y - 1)}`
    ),
  ],
  small: (x, y) => [open(x, y + 1, 5, 6)],
  // Squeezed shut with laughter.
  tight: (x, y, side) => [
    ink(line([x - side * 7, y - 6], [x + side * 5, y], [x - side * 7, y + 6])),
  ],
  // Looking up, the way people do when they think.
  up: (x, y) => [open(x - 2.5, y - 4, 6.6, 8)],
  // Worried: the eye under a brow that rises toward the middle of her face.
  worried: (x, y, side) => [
    open(x, y + 1, 6.2, 7.4),
    ink(line([x + side * 9, y - 13], [x - side * 6, y - 18]), 4),
  ],
} satisfies Record<
  typeof EyeSchema.Type,
  (x: number, y: number, side: number) => readonly Shape[]
>;

/** A smile that opens into a mouth: `wide` across, `deep` down. */
function smile(x: number, y: number, wide: number, deep: number) {
  return path({
    d: `M${n1(x - wide)},${n1(y)} Q${n1(x)},${n1(y + 14)} ${n1(x + wide)},${n1(y + 1)} Q${n1(x)},${n1(y + deep)} ${n1(x - wide)},${n1(y)} Z`,
    fill: INK,
    stroke: INK,
    strokeLinejoin: "round",
    strokeWidth: 3,
  });
}

/** The mouth, with its middle at x, y. */
const MOUTHS = {
  // The mouth of a pleased cat.
  cat: (x, y) => [
    ink(
      `M${n1(x - 15)},${n1(y + 2)} Q${n1(x - 13)},${n1(y + 12)} ${n1(x - 6)},${n1(y + 12)} Q${n1(x)},${n1(y + 12)} ${n1(x)},${n1(y + 4)} Q${n1(x)},${n1(y + 12)} ${n1(x + 6)},${n1(y + 12)} Q${n1(x + 13)},${n1(y + 12)} ${n1(x + 15)},${n1(y + 2)}`
    ),
  ],
  flat: (x, y) => [ink(line([x - 7, y + 6], [x + 7, y + 6]))],
  frown: (x, y) => [
    ink(
      `M${n1(x - 14)},${n1(y + 13)} Q${n1(x)},${n1(y)} ${n1(x + 14)},${n1(y + 13)}`
    ),
  ],
  gasp: (x, y) => [
    ellipse({ cx: n1(x), cy: n1(y + 9), fill: INK, rx: 8, ry: 10 }),
  ],
  grin: (x, y) => [smile(x, y, 26, 32)],
  hm: (x, y) => [ink(line([x - 2, y + 7], [x + 12, y + 5]))],
  laugh: (x, y) => [
    path({
      d: `M${n1(x - 20)},${n1(y)} Q${n1(x)},${n1(y + 5)} ${n1(x + 20)},${n1(y)} Q${n1(x + 16)},${n1(y + 26)} ${n1(x)},${n1(y + 26)} Q${n1(x - 16)},${n1(y + 26)} ${n1(x - 20)},${n1(y)} Z`,
      fill: INK,
      stroke: INK,
      strokeLinejoin: "round",
      strokeWidth: 3,
    }),
    ellipse({ cx: n1(x), cy: n1(y + 20), fill: PINK, rx: 9, ry: 5 }),
  ],
  oh: (x, y) => [
    ellipse({ cx: n1(x), cy: n1(y + 6), fill: INK, rx: 5, ry: 6 }),
  ],
  small: (x, y) => [
    ink(
      `M${n1(x - 8)},${n1(y + 4)} Q${n1(x)},${n1(y + 11)} ${n1(x + 8)},${n1(y + 4)}`
    ),
  ],
  smile: (x, y) => [smile(x, y, 21, 24)],
  smirk: (x, y) => [
    ink(
      `M${n1(x - 14)},${n1(y + 3)} Q${n1(x + 4)},${n1(y + 15)} ${n1(x + 20)},${n1(y - 1)}`
    ),
  ],
  // A pressed mouth with the tip of her tongue out at one corner.
  tongue: (x, y) => [
    ellipse({ cx: n1(x + 9), cy: n1(y + 10), fill: PINK, rx: 5, ry: 6 }),
    ink(line([x - 10, y + 6], [x + 10, y + 6])),
  ],
  wave: (x, y) => [
    ink(
      `M${n1(x - 15)},${n1(y + 6)} Q${n1(x - 7.5)},${n1(y)} ${n1(x)},${n1(y + 6)} Q${n1(x + 7.5)},${n1(y + 12)} ${n1(x + 15)},${n1(y + 6)}`
    ),
  ],
} satisfies Record<
  typeof MouthSchema.Type,
  (x: number, y: number) => readonly Shape[]
>;

/** What goes with a face: a sparkle, marks, a tear, a thought. */
const EXTRAS = {
  blush: [
    ellipse({ cx: 42, cy: 104, fill: PINK, opacity: 0.85, rx: 11, ry: 5.5 }),
    ellipse({ cx: 162, cy: 104, fill: PINK, opacity: 0.85, rx: 11, ry: 5.5 }),
  ],
  // Three short strokes of surprise above her right lobe.
  marks: [
    ink("M176,44 L180,30", 4),
    ink("M188,50 L198,40", 4),
    ink("M194,62 L206,58", 4),
  ],
  none: [],
  sparkle: [sparkle(172, 28, 10, POP.yellow)],
  // A small coil of confusion over her right lobe.
  swirl: [
    ink(
      "M176,44 C170,36 178,26 188,30 C198,34 196,48 186,48 C180,48 178,40 184,38",
      4
    ),
  ],
  // One tear under her left eye.
  tear: [
    path({
      d: "M30,100 C36,110 38,116 30,118 C22,116 24,110 30,100 Z",
      fill: BODY,
    }),
  ],
  // Three dots rising from her head: a thought on its way.
  thought: [
    circle({ cx: 160, cy: 44, fill: BODY, r: 4 }),
    circle({ cx: 171, cy: 31, fill: BODY, r: 5.5 }),
    circle({ cx: 185, cy: 15, fill: BODY, r: 7.5 }),
  ],
  // The letter of sleep, as two strokes.
  zed: [
    path({
      d: "M168,18 H186 L168,40 H186",
      fill: "none",
      stroke: BODY,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 5,
    }),
  ],
} satisfies Record<typeof ExtraSchema.Type, readonly Shape[]>;

/** The eyes, the mouth and what goes with them, for one mood. */
export function face(mood: typeof MoodSchema.Type, look: Look) {
  const [left, right, mouth, extra] = FACES[mood];
  return [
    group([...EYES[left](38, 88, -1), ...EYES[right](166, 88, 1)], {
      transform: `translate(${n1(look[0])} ${n1(look[1])})`,
    }),
    group(MOUTHS[mouth](102, 118), {
      transform: `translate(${n1(look[0] * 0.5)} ${n1(look[1] * 0.5)})`,
    }),
    ...EXTRAS[extra],
  ];
}
