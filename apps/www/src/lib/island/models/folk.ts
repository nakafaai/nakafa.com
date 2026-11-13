import { Match, Schema } from "effect";
import {
  box,
  type Face,
  meters as m,
  mirrored,
  rgb,
  tipped,
} from "@/lib/island/models/parts";

/** The villagers and the learner's own fox (ADR 0047, D10, D12 and D21). */
export const Folk = Schema.Literals(["cat", "rabbit", "bear", "fox"]);
export type Folk = typeof Folk.Type;

/** What tells one person from another: fur, the lighter fur of the face and chest, clothes, and the shape of the ears and tail. */
const LOOKS = {
  bear: {
    chest: 0xc9_a2_7a,
    fur: 0x8a_5a_3a,
    legs: 0x3b_4a_6b,
    shirt: 0x6f_9a_52,
  },
  cat: {
    chest: 0xf3_e6_d2,
    fur: 0x9a_9a_a4,
    legs: 0x5a_46_36,
    shirt: 0xd8_78_3a,
  },
  fox: {
    chest: 0xfa_f0_e2,
    fur: 0xe0_7a_2c,
    legs: 0x3b_34_46,
    shirt: 0x3f_7f_b8,
  },
  rabbit: {
    chest: 0xff_ff_ff,
    fur: 0xe9_df_d2,
    legs: 0x6b_4e_7a,
    shirt: 0xe4_b6_48,
  },
} satisfies Record<Folk, Record<string, number>>;

const INK = rgb(0x2a_1d_16);
const NOSE = rgb(0x4a_2a_24);

/** One side's ear, by the folk's kind: a cat's and a fox's point, a rabbit's stand tall, a bear's are round. */
function earOf(kind: Folk, fur: number, inner: number) {
  return Match.value(kind).pipe(
    Match.when("rabbit", () => [
      ...box(
        [m(0.06), m(1.6), m(-0.03)],
        [m(0.16), m(1.98), m(0.05)],
        rgb(fur)
      ),
      ...box(
        [m(0.085), m(1.64), m(0.05)],
        [m(0.135), m(1.94), m(0.06)],
        rgb(inner)
      ),
    ]),
    Match.when("bear", () =>
      box([m(0.13), m(1.58), m(-0.02)], [m(0.25), m(1.7), m(0.06)], rgb(fur))
    ),
    Match.orElse(() =>
      box(
        [m(0.08), m(1.6), m(-0.04)],
        [m(0.24), m(1.8), m(0.08)],
        rgb(fur),
        0.9
      )
    )
  );
}

/** A tail at the small of the back: a fox's long brush, a cat's thin tail, a rabbit's and a bear's stub. */
function tailOf(kind: Folk, fur: number, chest: number) {
  return Match.value(kind).pipe(
    Match.when("fox", () => [
      ...tipped(
        box(
          [m(-0.09), m(0.55), m(-0.5)],
          [m(0.09), m(0.72), m(-0.12)],
          rgb(fur)
        ),
        -0.5,
        [0, m(0.62), m(-0.12)]
      ),
      ...tipped(
        box(
          [m(-0.06), m(0.56), m(-0.62)],
          [m(0.06), m(0.7), m(-0.5)],
          rgb(chest)
        ),
        -0.5,
        [0, m(0.62), m(-0.12)]
      ),
    ]),
    Match.when("cat", () =>
      tipped(
        box(
          [m(-0.03), m(0.6), m(-0.48)],
          [m(0.03), m(0.66), m(-0.12)],
          rgb(fur)
        ),
        -0.9,
        [0, m(0.62), m(-0.12)]
      )
    ),
    Match.orElse(() =>
      box([m(-0.07), m(0.6), m(-0.2)], [m(0.07), m(0.72), m(-0.1)], rgb(chest))
    )
  );
}

/**
 * A person of the island at real scale, 1.8 m to the top of the head (two
 * blocks), standing on the origin and facing +z: legs in trousers, a shirt,
 * arms, a big friendly head with a muzzle, eyes and nose, and the folk's own
 * ears and tail. Cozy proportions: the head is a quarter of the height, so a
 * face reads from the camera's distance.
 */
export function folkFaces(kind: Folk): readonly Face[] {
  const look = LOOKS[kind];
  const fur = rgb(look.fur);
  const half = [
    ...box([m(0.04), 0, m(-0.09)], [m(0.17), m(0.62), m(0.09)], rgb(look.legs)),
    ...box([m(0.04), 0, m(-0.08)], [m(0.18), m(0.08), m(0.14)], INK),
    ...box(
      [m(0.26), m(0.7), m(-0.07)],
      [m(0.36), m(1.14), m(0.07)],
      rgb(look.shirt)
    ),
    ...box([m(0.26), m(0.6), m(-0.06)], [m(0.35), m(0.7), m(0.06)], fur),
    ...earOf(kind, look.fur, look.chest),
    ...box([m(0.07), m(1.4), m(0.235)], [m(0.13), m(1.48), m(0.245)], INK),
  ];
  return [
    ...half,
    ...mirrored(half),
    ...box(
      [m(-0.26), m(0.6), m(-0.15)],
      [m(0.26), m(1.18), m(0.15)],
      rgb(look.shirt),
      0.12
    ),
    ...box(
      [m(-0.12), m(0.86), m(0.15)],
      [m(0.12), m(1.12), m(0.16)],
      rgb(look.chest)
    ),
    ...box([m(-0.25), m(1.16), m(-0.21)], [m(0.25), m(1.62), m(0.235)], fur),
    ...box(
      [m(-0.12), m(1.2), m(0.235)],
      [m(0.12), m(1.36), m(0.33)],
      rgb(look.chest)
    ),
    ...box([m(-0.04), m(1.32), m(0.33)], [m(0.04), m(1.38), m(0.345)], NOSE),
    ...tailOf(kind, look.fur, look.chest),
  ];
}
