import type { Mammal } from "@repo/design-system/components/contents/biology/taxon/mammal";
import {
  joint,
  mammalForms,
} from "@repo/design-system/components/contents/biology/taxon/mammal";
import {
  cellsAt,
  fractalAt,
} from "@repo/design-system/components/three/field/noise";
import type { Form } from "@repo/design-system/components/three/organism/form";
import type { Loft } from "@repo/design-system/components/three/organism/loft";
import { dorsal } from "@repo/design-system/components/three/organism/loft";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Color } from "three";

const COAT = new Color(CLASSIFICATION_COLORS.catCoat);
const BELLY = new Color(CLASSIFICATION_COLORS.catBelly);
const SPOT = new Color(CLASSIFICATION_COLORS.catSpot);
const NOSE = new Color(CLASSIFICATION_COLORS.noseDark);

/** Whether a place lies in one of a leopard cat's solid spots, which run in rows along its body. */
function spotted(along: number, around: number, count: number) {
  const cell = cellsAt(along, around, count, 13, 157);
  return Math.sqrt(cell.nearest) < 0.3 && cell.owner > 0.1;
}

/**
 * A leopard cat's coat on its trunk, neck and head: yellow-brown above and
 * white below, solid dark spots in rows, four dark stripes from the brow
 * over the neck, and the two white stripes that run up from its eyes.
 */
const trunk: Loft["paint"] = (along, around, color) => {
  const back = Math.min(1, Math.max(0, dorsal(around) * 2.4 - 0.5));
  const grain = fractalAt(along, around, 30, 12, 159, 3);
  const top = Math.min(around, 1 - around);
  const neck = along > 0.6 && along < 0.9;
  const stripe =
    neck && top < 0.2 && Math.cos(top * 2 * Math.PI * 16) > 0.35 && top > 0.02;
  const brow = along > 0.82 && along < 0.93 && top > 0.035 && top < 0.07;
  const dark = neck ? stripe : spotted(along, around, 22) && along < 0.93;
  color
    .copy(BELLY)
    .lerp(COAT, back)
    .multiplyScalar(0.86 + 0.28 * grain)
    .lerp(SPOT, dark ? 0.9 : 0)
    .lerp(BELLY, brow ? 0.9 : 0)
    .lerp(BELLY, along > 0.94 && back < 0.6 ? 0.8 : 0)
    .lerp(NOSE, along > 0.978 && back > 0.5 ? 0.85 : 0);
};

/** A leopard cat's leg: brown outside, white inside, spotted to the wrist. */
const leg: Loft["paint"] = (along, around, color) => {
  color
    .copy(COAT)
    .lerp(BELLY, 0.3 + 0.35 * along)
    .lerp(SPOT, spotted(along, around, 12) && along < 0.7 ? 0.85 : 0);
};

/** A leopard cat's tail: spotted at its root, ringed towards its dark tip. */
const tail: Loft["paint"] = (along, around, color) => {
  const ring = along > 0.4 && Math.cos(along * 2 * Math.PI * 7) > 0.3;
  color
    .copy(COAT)
    .lerp(BELLY, 0.5 * (1 - dorsal(around)))
    .lerp(SPOT, ring || along > 0.92 || spotted(along, around, 8) ? 0.85 : 0);
};

/** The back of a leopard cat's ear: black with a white spot in its middle. */
const ear: Loft["paint"] = (along, _around, color) => {
  color.copy(along > 0.35 && along < 0.7 ? BELLY : SPOT);
};

/**
 * A leopard cat (Prionailurus bengalensis): the size of a house cat, but
 * longer in the leg and smaller in the head, with large upright ears, a
 * slim body and a thick tail half its body's length.
 */
const CAT: Mammal = {
  belly: 0.06,
  coat: { ear, fore: leg, hind: leg, tail, trunk },
  ear: {
    at: [0.3, 0.44, 0.034],
    chord: 0.056,
    span: 0.066,
    up: [-0.1, 1, 0.3],
  },
  fore: [
    joint(0.15, 0.365, 0.02, 0, 0),
    joint(0.145, 0.34, 0.032, 0.045, 0.022),
    joint(0.14, 0.29, 0.04, 0.06, 0.032),
    joint(0.13, 0.2, 0.044, 0.034, 0.025),
    joint(0.14, 0.085, 0.044, 0.022, 0.02),
    joint(0.143, 0.03, 0.044, 0.025, 0.025),
    joint(0.172, 0.016, 0.044, 0.022, 0.026),
    joint(0.19, 0.011, 0.044, 0, 0),
  ],
  hind: [
    joint(-0.19, 0.375, 0.02, 0, 0),
    joint(-0.195, 0.35, 0.032, 0.05, 0.022),
    joint(-0.2, 0.295, 0.042, 0.085, 0.036),
    joint(-0.165, 0.2, 0.048, 0.048, 0.028),
    joint(-0.24, 0.11, 0.047, 0.023, 0.02),
    joint(-0.226, 0.03, 0.047, 0.025, 0.025),
    joint(-0.196, 0.016, 0.047, 0.022, 0.026),
    joint(-0.178, 0.011, 0.047, 0, 0),
  ],
  relief: () => 0,
  seed: 163,
  square: 2.1,
  tail: [
    joint(-0.265, 0.325, 0, 0.022, 0.022),
    joint(-0.34, 0.28, 0, 0.024, 0.024),
    joint(-0.41, 0.2, 0, 0.025, 0.025),
    joint(-0.45, 0.13, 0, 0.024, 0.024),
    joint(-0.47, 0.085, 0, 0.018, 0.018),
    joint(-0.475, 0.07, 0, 0, 0),
  ],
  trunk: [
    joint(-0.29, 0.32, 0, 0, 0),
    joint(-0.277, 0.32, 0, 0.032, 0.04),
    joint(-0.22, 0.325, 0, 0.056, 0.07),
    joint(-0.11, 0.315, 0, 0.052, 0.064),
    joint(0, 0.31, 0, 0.054, 0.068),
    joint(0.09, 0.31, 0, 0.056, 0.076),
    joint(0.16, 0.325, 0, 0.05, 0.07),
    joint(0.225, 0.36, 0, 0.042, 0.054),
    joint(0.272, 0.386, 0, 0.05, 0.054),
    joint(0.312, 0.392, 0, 0.056, 0.054),
    joint(0.35, 0.378, 0, 0.04, 0.038),
    joint(0.376, 0.368, 0, 0.029, 0.026),
    joint(0.385, 0.366, 0, 0, 0),
  ],
};

/** The leopard cat's whole body at a level of detail. */
export function catForms(detail: number): readonly Form[] {
  return mammalForms(CAT, detail);
}
