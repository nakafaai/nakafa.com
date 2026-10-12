import { Schema } from "effect";

/**
 * The head: the hammer with its two lobes and the two cat ears, closed under
 * the chin where it sits on the body.
 */
export const HEAD =
  "M30,58 C46,56 60,62 72,56 C74,46 76,36 82,32 C86,30 90,34 94,40 C98,46 108,46 112,40 C116,34 120,30 124,32 C130,36 132,46 134,56 " +
  "C148,62 162,56 172,58 C190,60 198,76 196,92 C194,108 180,116 164,114 C150,112 140,112 136,122 L138,148 L66,148 L62,120 " +
  "C66,114 60,112 52,114 C40,116 22,116 10,102 C2,90 8,62 30,58 Z";

/**
 * The body of the octopus: a round drop that starts right under the chin, so
 * she has shoulders and no long neck.
 */
export const TORSO =
  "M64,116 C52,126 42,148 42,172 C42,196 68,210 102,210 C136,210 162,196 162,172 C162,148 152,126 140,116 Z";

/** The pale face: the inside of the hammer, down the chin and over the belly. */
export const PALE =
  "M32,68 C46,66 60,72 76,68 C96,64 118,66 134,68 C148,72 162,66 170,68 C183,70 188,82 186,92 C184,102 176,106 164,104 " +
  "C148,102 132,102 126,116 C128,130 148,146 148,172 C148,190 127,199 102,199 C77,199 56,190 56,172 C56,146 76,130 76,120 " +
  "C74,106 62,104 50,106 C36,108 22,104 18,94 C14,82 19,69 32,68 Z";

/** The fin on her back. From the front it shows behind one shoulder. */
export const FIN = "M64,118 C48,118 30,126 16,146 C29,143 41,146 49,156 Z";

/**
 * Where an arm starts (her left shoulder; the right one is its mirror), and
 * how thick her limbs are at the start and at the tip. A limb starts deep
 * inside her body, deeper than it is wide, so its end never shows, and it is
 * widest where it leaves her body: an arm grows out of the outline of her body
 * the way a tentacle does, it is not put on top of it.
 */
export const SHOULDER = [80, 146] as const;
export const ARM = { thick: 25, thin: 10 };
export const LEG = { thick: 32, thin: 12 };

/** The ways she stands in a tile, and the one in which she looks over an edge. */
export const LeanSchema = Schema.Literals(["right", "left", "center", "peek"]);

/** Which way she faces: `left` mirrors her, fin and all. */
export const SideSchema = Schema.Literals(["right", "left"]);

/** How much of her a window shows: all of her, a tile, or what is over an edge. */
export const CutSchema = Schema.Literals(["whole", "bust", "peek"]);

/**
 * How the half figure sits in its 200 unit window. In a tile she is small
 * enough for her whole head to be inside a round frame, and low enough for the
 * frame to cut her at the widest part of her body. Over an edge she stands
 * higher, with room beside her for the two arm tips that hold on.
 */
export const LEANS = {
  right: { turn: -9, size: 0.86, x: 8, y: 10 },
  left: { turn: 9, size: 0.86, x: -8, y: 10 },
  center: { turn: 0, size: 0.9, x: 0, y: 6 },
  peek: { turn: 0, size: 1, x: 0, y: 30 },
} satisfies Record<typeof LeanSchema.Type, unknown>;

/** The window on her whole figure: room for raised arms and for what she holds. */
export const WHOLE_BOX = [-48, -20, 300, 310] as const;

/** The window on her half figure. */
export const HALF_BOX = [0, 0, 200, 200] as const;
