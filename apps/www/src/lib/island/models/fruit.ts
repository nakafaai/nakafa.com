import { Schema } from "effect";
import { around, lobe, toned } from "@/lib/island/models/forms";
import { HUES } from "@/lib/island/models/hues";
import type { Face } from "@/lib/island/models/parts";
import { meters, rgb } from "@/lib/island/models/parts";
import { rod, scaled, tube } from "@/lib/island/models/solids";

/** The fruit a shaken tree drops (ADR 0050, W2): a mango, a coconut, a hand of bananas. */
export const Fruit = Schema.Literals(["mango", "coconut", "banana"]);
export type Fruit = typeof Fruit.Type;

/** A ripe mango's blush, the green it keeps underneath, and a coconut's husk. */
const SKIN = {
  blush: rgb(0xe9_a1_3a),
  green: rgb(0x8f_ae_3c),
  husk: rgb(0x6a_4a_2c),
} as const;

/** A mango, 16 cm across and 20 cm long: green underneath, blushing orange on top, with the stub of its stalk. */
function mangoOf(): readonly Face[] {
  return [
    ...lobe(
      [0, 0, 0],
      [0.08, 0.1, 0.07],
      (spot) => (spot.along > 0.5 ? SKIN.blush : SKIN.green),
      3,
      6
    ),
    ...rod([0, 0.09, 0], [0.01, 0.12, 0], [0.012, 0.008], HUES.bark, 4),
  ];
}

/** A coconut in its husk, 26 cm across: its sides a tone apart, so it shows itself turning as it rolls. */
function coconutOf(): readonly Face[] {
  return lobe(
    [0, 0, 0],
    [0.13, 0.13, 0.13],
    (spot) => (spot.side % 2 === 0 ? SKIN.husk : toned(SKIN.husk, 0.84)),
    3,
    6
  );
}

/** A hand of five bananas, 22 cm across: each finger curves down and out from the stalk they share, yellow with a dark tip. */
function bananaOf(): readonly Face[] {
  return [
    ...rod([0, 0.1, 0], [0, 0.04, 0], [0.018, 0.022], HUES.bark, 4),
    ...around(5, 0, (angle, index) => {
      const out = [Math.cos(angle), Math.sin(angle)] as const;
      return tube(
        [
          { at: [0, 0.05, 0], high: 0.016, wide: 0.016 },
          {
            at: [out[0] * 0.06, 0.02, out[1] * 0.06],
            high: 0.024,
            wide: 0.024,
          },
          {
            at: [out[0] * 0.095, -0.05, out[1] * 0.095],
            high: 0.02,
            wide: 0.02,
          },
          { at: [out[0] * 0.085, -0.1, out[1] * 0.085], high: 0, wide: 0 },
        ],
        (spot) => {
          if (spot.segment === 2) {
            return HUES.dark;
          }
          return index % 2 === 0 ? HUES.yellow : toned(HUES.yellow, 0.88);
        },
        4
      );
    }),
  ];
}

/** How each fruit is built, in meters, about its own middle. */
const BUILDERS: Record<Fruit, () => readonly Face[]> = {
  banana: bananaOf,
  coconut: coconutOf,
  mango: mangoOf,
};

/**
 * A fruit's faces, in blocks, about its own middle and not standing on the
 * ground, so a fruit that rolls turns about itself.
 */
export function fruitFaces(kind: Fruit): readonly Face[] {
  return scaled(BUILDERS[kind](), meters(1));
}
