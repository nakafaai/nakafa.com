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

const COAT = new Color(CLASSIFICATION_COLORS.bearCoat);
const MUZZLE = new Color(CLASSIFICATION_COLORS.bearMuzzle);
const CHEST = new Color(CLASSIFICATION_COLORS.bearChest);
const NOSE = new Color(CLASSIFICATION_COLORS.noseDark);

/**
 * A sun bear's coat on its trunk, neck and head: short, sleek and black,
 * with the pale muzzle that reaches above the eyes and the ochre crescent
 * on its chest that the species is named for.
 */
const trunk: Loft["paint"] = (along, around, color) => {
  const under = Math.abs(around - 0.5);
  const sheen = fractalAt(along, around, 40, 14, 167, 3);
  const crescent =
    under < 0.24 && Math.abs(along - 0.545 - 0.34 * under) < 0.02;
  const muzzle = Math.min(1, Math.max(0, (along - 0.86) * 30));
  color
    .copy(COAT)
    .multiplyScalar(0.75 + 0.6 * sheen)
    .lerp(CHEST, crescent ? 0.92 : 0)
    .lerp(MUZZLE, muzzle * 0.9)
    .lerp(NOSE, along > 0.975 && dorsal(around) > 0.35 ? 0.95 : 0);
};

/** A sun bear's leg: black to its bare, pale-clawed paw. */
const leg: Loft["paint"] = (along, around, color) => {
  color
    .copy(COAT)
    .multiplyScalar(0.75 + 0.6 * fractalAt(along, around, 20, 10, 169, 3))
    .lerp(MUZZLE, along > 0.93 ? 0.5 : 0);
};

/** A sun bear's ear and its stub of a tail: black like the rest of it. */
const plain: Loft["paint"] = (_along, _around, color) => {
  color.copy(COAT);
};

/**
 * A sun bear (Helarctos malayanus): the smallest bear, stocky and
 * short-coated, with a broad flat head, a short muzzle, small round ears set
 * low, a loose-skinned neck and forelegs that bow inwards over long claws.
 */
const BEAR: Mammal = {
  belly: 0.05,
  coat: { ear: plain, fore: leg, hind: leg, tail: plain, trunk },
  ear: {
    at: [0.262, 0.416, 0.07],
    chord: 0.05,
    span: 0.036,
    up: [-0.1, 1, 0.5],
  },
  fore: [
    joint(0.15, 0.37, 0.04, 0, 0),
    joint(0.145, 0.34, 0.065, 0.07, 0.035),
    joint(0.14, 0.26, 0.082, 0.09, 0.055),
    joint(0.13, 0.15, 0.088, 0.056, 0.046),
    joint(0.14, 0.065, 0.082, 0.046, 0.042),
    joint(0.152, 0.03, 0.074, 0.048, 0.044),
    joint(0.2, 0.018, 0.066, 0.036, 0.042),
    joint(0.226, 0.013, 0.064, 0, 0),
  ],
  hind: [
    joint(-0.19, 0.38, 0.04, 0, 0),
    joint(-0.195, 0.35, 0.065, 0.08, 0.035),
    joint(-0.2, 0.26, 0.084, 0.11, 0.06),
    joint(-0.185, 0.15, 0.09, 0.064, 0.05),
    joint(-0.215, 0.065, 0.09, 0.046, 0.042),
    joint(-0.2, 0.03, 0.09, 0.05, 0.044),
    joint(-0.15, 0.018, 0.09, 0.036, 0.042),
    joint(-0.126, 0.013, 0.09, 0, 0),
  ],
  relief: (along) =>
    along > 0.56 && along < 0.68
      ? 0.02 * Math.sin((along - 0.56) * 2 * Math.PI * 28)
      : 0,
  seed: 171,
  square: 2.25,
  tail: [
    joint(-0.29, 0.31, 0, 0.022, 0.022),
    joint(-0.325, 0.28, 0, 0.017, 0.017),
    joint(-0.335, 0.262, 0, 0, 0),
  ],
  trunk: [
    joint(-0.31, 0.31, 0, 0, 0),
    joint(-0.295, 0.31, 0, 0.07, 0.08),
    joint(-0.21, 0.32, 0, 0.112, 0.128),
    joint(-0.09, 0.312, 0, 0.118, 0.134),
    joint(0.03, 0.3, 0, 0.118, 0.136),
    joint(0.13, 0.305, 0, 0.112, 0.13),
    joint(0.2, 0.325, 0, 0.09, 0.104),
    joint(0.255, 0.34, 0, 0.086, 0.086),
    joint(0.305, 0.335, 0, 0.08, 0.074),
    joint(0.352, 0.318, 0, 0.058, 0.054),
    joint(0.4, 0.302, 0, 0.046, 0.042),
    joint(0.425, 0.296, 0, 0.038, 0.034),
    joint(0.436, 0.294, 0, 0, 0),
  ],
};

/** The sun bear's whole body at a level of detail. */
export function bearForms(detail: number): readonly Form[] {
  return mammalForms(BEAR, detail);
}
