import type { Mammal } from "@repo/design-system/components/contents/biology/taxon/mammal";
import {
  joint,
  mammalForms,
} from "@repo/design-system/components/contents/biology/taxon/mammal";
import {
  fractalAt,
} from "@repo/design-system/components/three/field/noise";
import type { Form } from "@repo/design-system/components/three/organism/form";
import type { Loft } from "@repo/design-system/components/three/organism/loft";
import { dorsal } from "@repo/design-system/components/three/organism/loft";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Color } from "three";

const BLACK = new Color(CLASSIFICATION_COLORS.tapirBlack);
const WHITE = new Color(CLASSIFICATION_COLORS.tapirWhite);

/**
 * A Malayan tapir's coat on its trunk, neck and head: black in front, and
 * white from behind the shoulders over the back and rump, the saddle that
 * breaks up its outline in the forest at night.
 */
const trunk: Loft["paint"] = (along, around, color) => {
  const edge = 0.47 + 0.03 * (fractalAt(along, around, 4, 9, 173, 2) - 0.5);
  const saddle = Math.min(1, Math.max(0, (edge - along) * 40));
  const stub = along < 0.03 ? 0 : 1;
  const grain = fractalAt(along, around, 30, 14, 175, 3);
  color
    .copy(BLACK)
    .lerp(WHITE, saddle * stub)
    .multiplyScalar(0.82 + 0.36 * grain);
};

/** A tapir's foreleg: black from shoulder to hoof. */
const fore: Loft["paint"] = (along, around, color) => {
  color
    .copy(BLACK)
    .multiplyScalar(0.8 + 0.4 * fractalAt(along, around, 16, 8, 177, 3));
};

/** A tapir's hind leg: the white of the rump runs onto the thigh, and the rest is black. */
const hind: Loft["paint"] = (along, around, color) => {
  color
    .copy(BLACK)
    .lerp(WHITE, Math.min(1, Math.max(0, (0.3 - along) * 14)))
    .multiplyScalar(0.8 + 0.4 * fractalAt(along, around, 16, 8, 179, 3));
};

/** A tapir's ear: black with the white rim at its tip. */
const ear: Loft["paint"] = (along, _around, color) => {
  color.copy(along > 0.8 ? WHITE : BLACK);
};

/** A tapir's stub of a tail: white like its rump. */
const tail: Loft["paint"] = (_along, _around, color) => {
  color.copy(WHITE);
};

/**
 * A Malayan tapir (Tapirus indicus): a barrel of a body that is highest at
 * the rounded rump, short sturdy legs, a short thick neck, and a long head
 * that ends in the short trunk it reaches for leaves with.
 */
const TAPIR: Mammal = {
  belly: 0.04,
  coat: { ear, fore, hind, tail, trunk },
  ear: {
    at: [0.27, 0.45, 0.05],
    chord: 0.05,
    span: 0.062,
    up: [-0.25, 1, 0.3],
  },
  fore: [
    joint(0.15, 0.42, 0.04, 0, 0),
    joint(0.145, 0.38, 0.065, 0.07, 0.035),
    joint(0.14, 0.29, 0.08, 0.085, 0.052),
    joint(0.135, 0.17, 0.082, 0.046, 0.038),
    joint(0.14, 0.065, 0.08, 0.033, 0.032),
    joint(0.146, 0.028, 0.08, 0.04, 0.038),
    joint(0.174, 0.015, 0.08, 0.03, 0.036),
    joint(0.19, 0.011, 0.08, 0, 0),
  ],
  hind: [
    joint(-0.21, 0.44, 0.04, 0, 0),
    joint(-0.215, 0.4, 0.065, 0.09, 0.035),
    joint(-0.22, 0.3, 0.084, 0.115, 0.058),
    joint(-0.195, 0.18, 0.088, 0.06, 0.042),
    joint(-0.238, 0.085, 0.086, 0.033, 0.032),
    joint(-0.226, 0.028, 0.086, 0.04, 0.038),
    joint(-0.2, 0.015, 0.086, 0.03, 0.036),
    joint(-0.183, 0.011, 0.086, 0, 0),
  ],
  relief: () => 0,
  seed: 181,
  square: 2.2,
  tail: [
    joint(-0.335, 0.37, 0, 0.018, 0.018),
    joint(-0.36, 0.34, 0, 0.013, 0.013),
    joint(-0.367, 0.325, 0, 0, 0),
  ],
  trunk: [
    joint(-0.35, 0.36, 0, 0, 0),
    joint(-0.338, 0.36, 0, 0.08, 0.1),
    joint(-0.26, 0.38, 0, 0.125, 0.15),
    joint(-0.12, 0.376, 0, 0.134, 0.158),
    joint(0.02, 0.362, 0, 0.13, 0.154),
    joint(0.14, 0.356, 0, 0.12, 0.144),
    joint(0.22, 0.362, 0, 0.09, 0.114),
    joint(0.29, 0.366, 0, 0.07, 0.09),
    joint(0.35, 0.352, 0, 0.06, 0.074),
    joint(0.41, 0.322, 0, 0.045, 0.054),
    joint(0.455, 0.282, 0, 0.032, 0.035),
    joint(0.474, 0.238, 0, 0.026, 0.026),
    joint(0.478, 0.212, 0, 0, 0),
  ],
};

/** The Malayan tapir's whole body at a level of detail. */
export function tapirForms(detail: number): readonly Form[] {
  return mammalForms(TAPIR, detail);
}
