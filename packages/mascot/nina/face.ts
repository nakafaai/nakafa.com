import { NINA, PINK, POP } from "@repo/mascot/color";
import { EYES, type EyeSchema } from "@repo/mascot/nina/eye";
import { ink } from "@repo/mascot/nina/ink";
import type { Mark } from "@repo/mascot/nina/mark";
import { MOUTHS, type MouthSchema } from "@repo/mascot/nina/mouth";
import { tenth } from "@repo/mascot/nina/point";
import { circle, ellipse, group, path, type Shape } from "@repo/mascot/shape";
import { sparkle } from "@repo/mascot/sparkle";
import { Schema } from "effect";

/** Her faces. `aha` is `happy` with a sparkle: the moment she gets it. */
export const MoodSchema = Schema.Literals([
  "hello",
  "happy",
  "aha",
  "calm",
  "curious",
  "thoughtful",
  "focused",
  "surprised",
  "confused",
  "sad",
  "proud",
  "winking",
  "laughing",
  "shy",
  "asleep",
]);

/** Where her eyes look, as a small offset from straight ahead. */
export const LookSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);

export type Look = typeof LookSchema.Type;

/** What goes with a face besides its eyes and its mouth. */
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
  hello: ["dot", "dot", "smile", "none"],
  happy: ["arc", "arc", "grin", "none"],
  aha: ["arc", "arc", "grin", "sparkle"],
  calm: ["dot", "dot", "small", "none"],
  curious: ["dot", "brow", "oh", "none"],
  thoughtful: ["up", "up", "hm", "thought"],
  focused: ["set", "set", "tongue", "none"],
  surprised: ["big", "big", "gasp", "marks"],
  confused: ["dot", "small", "wave", "swirl"],
  sad: ["worried", "worried", "frown", "tear"],
  proud: ["arc", "arc", "cat", "none"],
  winking: ["dot", "arc", "smirk", "none"],
  laughing: ["tight", "tight", "laugh", "none"],
  shy: ["aside", "aside", "small", "blush"],
  asleep: ["shut", "shut", "flat", "zed"],
} satisfies Record<
  typeof MoodSchema.Type,
  readonly [
    typeof EyeSchema.Type,
    typeof EyeSchema.Type,
    typeof MouthSchema.Type,
    typeof ExtraSchema.Type,
  ]
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
      fill: NINA.body,
    }),
  ],
  // Three dots rising from her head: a thought on its way.
  thought: [
    circle({ cx: 160, cy: 44, fill: NINA.body, r: 4 }),
    circle({ cx: 171, cy: 31, fill: NINA.body, r: 5.5 }),
    circle({ cx: 185, cy: 15, fill: NINA.body, r: 7.5 }),
  ],
  // The letter of sleep, as two strokes.
  zed: [
    path({
      d: "M168,18 H186 L168,40 H186",
      fill: "none",
      stroke: NINA.body,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 5,
    }),
  ],
} satisfies Record<typeof ExtraSchema.Type, readonly Shape<Mark>[]>;

/** The eyes, the mouth and what goes with them, for one mood. */
export function face(mood: typeof MoodSchema.Type, look: Look) {
  const [left, right, mouth, extra] = FACES[mood];
  return [
    group([...EYES[left](38, 88, -1), ...EYES[right](166, 88, 1)], {
      transform: `translate(${tenth(look[0])} ${tenth(look[1])})`,
    }),
    group(MOUTHS[mouth](102, 118), {
      transform: `translate(${tenth(look[0] * 0.5)} ${tenth(look[1] * 0.5)})`,
    }),
    ...EXTRAS[extra],
  ];
}
