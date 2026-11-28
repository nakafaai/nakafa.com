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

const COAT = new Color(CLASSIFICATION_COLORS.leopardCoat);
const BELLY = new Color(CLASSIFICATION_COLORS.leopardBelly);
const SPOT = new Color(CLASSIFICATION_COLORS.leopardSpot);
const ROSE = new Color(CLASSIFICATION_COLORS.leopardRose);
const NOSE = new Color(CLASSIFICATION_COLORS.noseDark);

/**
 * How dark a leopard's coat is marked at a place, and how much of its
 * rosette's warm middle shows: open rings of black round a tawny centre,
 * each broken into two or three blotches.
 */
function rosette(along: number, around: number) {
  const cell = cellsAt(along, around, 17, 10, 131);
  const from = Math.sqrt(cell.nearest);
  const broken = fractalAt(along, around, 60, 34, 137, 2);
  const ring = from > 0.2 && from < 0.42 && broken > 0.34 && cell.owner > 0.08;
  return { middle: from <= 0.2 && cell.owner > 0.08, ring };
}

/** How dark a leopard's solid spots are at a place: on its head, legs and tail tip. */
function spot(along: number, around: number, count: number) {
  const cell = cellsAt(along, around, count, 9, 139);
  return Math.sqrt(cell.nearest) < 0.27 && cell.owner > 0.15;
}

/** Whether a place lies on the line of a cat's mouth, which runs back from under its nose. */
function mouth(along: number, around: number) {
  const under = Math.abs(around - 0.5);
  return (
    along > 0.945 && Math.abs(under - 0.19 + 2.2 * (along - 0.945)) < 0.012
  );
}

/**
 * A leopard's coat on its trunk, neck and head: tawny gold above and cream
 * below, rosettes over the back and flanks that shrink to solid spots on
 * the head and belly, a dark nose and pale muzzle.
 */
const trunk: Loft["paint"] = (along, around, color) => {
  const back = Math.min(1, Math.max(0, dorsal(around) * 2.2 - 0.35));
  const grain = fractalAt(along, around, 30, 12, 141, 3);
  const marks = rosette(along, around);
  const head = along > 0.72;
  const dark = head || back < 0.25 ? spot(along, around, 30) : marks.ring;
  color
    .copy(BELLY)
    .lerp(COAT, back)
    .lerp(ROSE, marks.middle && !head && back > 0.25 ? 0.55 : 0)
    .multiplyScalar(0.86 + 0.28 * grain)
    .lerp(SPOT, dark && along < 0.955 ? 0.92 : 0)
    .lerp(BELLY, along > 0.93 && back < 0.5 ? 0.7 : 0)
    .lerp(NOSE, mouth(along, around) ? 0.85 : 0)
    .lerp(NOSE, along > 0.972 && back > 0.5 ? 0.9 : 0);
};

/** A leopard's leg: gold outside and pale inside, with solid spots that thin out towards the paw. */
const leg: Loft["paint"] = (along, around, color) => {
  const grain = fractalAt(along, around, 18, 8, 143, 3);
  color
    .copy(COAT)
    .lerp(BELLY, 0.25 + 0.3 * along)
    .multiplyScalar(0.86 + 0.28 * grain)
    .lerp(SPOT, spot(along, around, 16) && along < 0.82 ? 0.9 : 0);
};

/** A leopard's tail: rosettes that close into black rings and a dark tip. */
const tail: Loft["paint"] = (along, around, color) => {
  const marks = rosette(along * 0.5, around);
  color
    .copy(COAT)
    .lerp(BELLY, 0.6 * (1 - dorsal(around)))
    .lerp(SPOT, marks.ring || along > 0.93 ? 0.9 : 0);
};

/** The back of a leopard's ear: black with a pale patch near the tip. */
const ear: Loft["paint"] = (along, _around, color) => {
  color.copy(along > 0.55 && along < 0.85 ? BELLY : SPOT).lerp(COAT, 0.2);
};

/**
 * A leopard (Panthera pardus): a long, low, muscular cat with a deep chest,
 * a tucked belly, a broad skull on a thick neck, short rounded ears and a
 * tail as long as its body.
 */
const LEOPARD: Mammal = {
  belly: 0.08,
  coat: { ear, fore: leg, hind: leg, tail, trunk },
  ear: {
    at: [0.3, 0.435, 0.045],
    chord: 0.052,
    span: 0.046,
    up: [-0.15, 1, 0.4],
  },
  fore: [
    joint(0.16, 0.36, 0.03, 0, 0),
    joint(0.155, 0.33, 0.044, 0.06, 0.03),
    joint(0.15, 0.27, 0.052, 0.085, 0.04),
    joint(0.138, 0.19, 0.058, 0.05, 0.036),
    joint(0.148, 0.09, 0.058, 0.032, 0.029),
    joint(0.152, 0.035, 0.058, 0.036, 0.035),
    joint(0.19, 0.02, 0.058, 0.032, 0.038),
    joint(0.214, 0.014, 0.058, 0, 0),
  ],
  hind: [
    joint(-0.19, 0.37, 0.03, 0, 0),
    joint(-0.195, 0.34, 0.044, 0.07, 0.03),
    joint(-0.2, 0.28, 0.054, 0.115, 0.048),
    joint(-0.168, 0.19, 0.062, 0.066, 0.04),
    joint(-0.243, 0.105, 0.06, 0.032, 0.028),
    joint(-0.228, 0.035, 0.06, 0.034, 0.034),
    joint(-0.19, 0.02, 0.06, 0.032, 0.038),
    joint(-0.166, 0.014, 0.06, 0, 0),
  ],
  relief: () => 0,
  seed: 151,
  square: 2.15,
  tail: [
    joint(-0.27, 0.31, 0, 0.024, 0.024),
    joint(-0.37, 0.25, 0, 0.021, 0.021),
    joint(-0.46, 0.15, 0, 0.019, 0.019),
    joint(-0.53, 0.1, 0, 0.018, 0.018),
    joint(-0.6, 0.12, 0, 0.017, 0.017),
    joint(-0.635, 0.17, 0, 0.014, 0.014),
    joint(-0.645, 0.19, 0, 0, 0),
  ],
  trunk: [
    joint(-0.3, 0.305, 0, 0, 0),
    joint(-0.285, 0.305, 0, 0.045, 0.058),
    joint(-0.22, 0.31, 0, 0.078, 0.098),
    joint(-0.11, 0.3, 0, 0.076, 0.094),
    joint(0, 0.293, 0, 0.08, 0.1),
    joint(0.1, 0.296, 0, 0.084, 0.112),
    joint(0.17, 0.315, 0, 0.078, 0.104),
    joint(0.235, 0.35, 0, 0.062, 0.08),
    joint(0.285, 0.378, 0, 0.066, 0.074),
    joint(0.325, 0.39, 0, 0.07, 0.07),
    joint(0.36, 0.38, 0, 0.058, 0.058),
    joint(0.39, 0.366, 0, 0.045, 0.046),
    joint(0.411, 0.358, 0, 0.04, 0.04),
    joint(0.418, 0.356, 0, 0, 0),
  ],
};

/** The leopard's whole body at a level of detail. */
export function leopardForms(detail: number): readonly Form[] {
  return mammalForms(LEOPARD, detail);
}
