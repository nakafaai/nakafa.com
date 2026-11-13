import type { Coat, Species } from "@/lib/island/models/coat";
import { earsOf, eyesOf, tailOf } from "@/lib/island/models/features";
import { type Face, mirrored } from "@/lib/island/models/parts";
import { ball, rod, tube } from "@/lib/island/models/solids";

/**
 * A monkey or an ape sitting up (ADR 0047, D21), about one tall, on the origin
 * and facing +z: a round belly and chest, folded legs, long arms resting on
 * the ground before it, a round head with a pale face and muzzle, eyes, ears
 * by its trait, and its tail curling behind.
 */
export function primate(species: Species, coat: Coat): readonly Face[] {
  const half = [
    ...rod([0.11, 0.2, 0], [0.15, 0.17, 0.24], [0.07, 0.06], coat.leg, 4),
    ...rod([0.15, 0.17, 0.24], [0.14, 0.05, 0.25], [0.06, 0.05], coat.leg, 4),
    ...rod(
      [0.14, 0.04, 0.23],
      [0.15, 0.04, 0.33],
      [0.05, 0.035],
      coat.belly,
      4
    ),
    ...rod([0.18, 0.6, 0.04], [0.24, 0.32, 0.16], [0.06, 0.05], coat.body, 4),
    ...rod([0.24, 0.32, 0.16], [0.22, 0.05, 0.26], [0.05, 0.045], coat.body, 4),
    ...ball([0.22, 0.03, 0.28], [0.05, 0.03, 0.06], coat.belly, 1, 6),
  ];
  return [
    ...tube(
      [
        { at: [0, 0.08, -0.02], high: 0, wide: 0 },
        { at: [0, 0.16, -0.01], high: 0.13, wide: 0.17 },
        { at: [0, 0.36, 0.01], high: 0.15, wide: 0.19 },
        { at: [0, 0.58, 0.03], high: 0.12, wide: 0.18 },
        { at: [0, 0.68, 0.04], high: 0.06, wide: 0.09 },
      ],
      // An upright tube's `up` faces forward, so the belly is its front.
      (spot) => (spot.up > 0.4 ? coat.belly : coat.body),
      6
    ),
    ...half,
    ...mirrored(half),
    ...ball([0, 0.8, 0.05], [0.13, 0.13, 0.12], coat.body, 3, 8),
    ...ball([0, 0.77, 0.14], [0.09, 0.08, 0.05], coat.belly, 2, 6),
    ...ball([0, 0.73, 0.18], [0.055, 0.04, 0.035], coat.accent, 1, 6),
    ...eyesOf(
      {
        eye: [0.05, 0.82, 0.155],
        jaw: [0, 0.7, 0.16],
        size: 0.18,
        top: [0, 0.92, 0.04],
        wide: 0.13,
      },
      coat
    ),
    ...earsOf(
      species.traits.ears,
      {
        eye: [0, 0, 0],
        jaw: [0, 0, 0],
        size: 0.22,
        top: [0, 0.76, 0.02],
        wide: 0.24,
      },
      coat
    ),
    ...tailOf(species.traits.tail, [0, 0.3, -0.16], 0.42, coat),
  ];
}
