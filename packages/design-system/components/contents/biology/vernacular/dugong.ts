import { fractalAt } from "@repo/design-system/components/three/field/noise";
import { faces } from "@repo/design-system/components/three/organism/budget";
import type { Form } from "@repo/design-system/components/three/organism/form";
import { attachForm } from "@repo/design-system/components/three/organism/form";
import type {
  Loft,
  Station,
} from "@repo/design-system/components/three/organism/loft";
import {
  dorsal,
  finBody,
  loftBody,
} from "@repo/design-system/components/three/organism/loft";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Color } from "three";

const BACK = new Color(CLASSIFICATION_COLORS.dugong);
const BELLY = new Color(CLASSIFICATION_COLORS.dugongBelly);

/**
 * The sections of a dugong from the tail stock to the snout, head towards
 * +x: a heavy spindle that is deepest behind the flippers, a thick neck, a
 * small head, and the broad snout that turns down to the seagrass it grazes.
 */
const SPINE: readonly Station[] = [
  { centre: [-0.46, 0.004, 0], tall: 0, wide: 0 },
  { centre: [-0.42, 0.004, 0], tall: 0.026, wide: 0.02 },
  { centre: [-0.3, 0.006, 0], tall: 0.066, wide: 0.052 },
  { centre: [-0.15, 0.01, 0], tall: 0.116, wide: 0.108 },
  { centre: [0, 0.01, 0], tall: 0.14, wide: 0.138 },
  { centre: [0.14, 0.008, 0], tall: 0.13, wide: 0.126 },
  { centre: [0.26, 0, 0], tall: 0.1, wide: 0.096 },
  { centre: [0.35, -0.012, 0], tall: 0.086, wide: 0.08 },
  { centre: [0.42, -0.04, 0], tall: 0.07, wide: 0.07 },
  { centre: [0.46, -0.078, 0], tall: 0.048, wide: 0.062 },
  { centre: [0.472, -0.094, 0], tall: 0, wide: 0 },
];

/**
 * A dugong's colour at a place: grey-brown above and paler below, mottled
 * and scarred as old animals are, darker round the muzzle's bristled disc.
 */
const paint: Loft["paint"] = (along, around, color) => {
  const back = Math.min(1, Math.max(0, dorsal(around) * 1.5 - 0.2));
  const scars = fractalAt(along, around, 9, 5, 61, 3);
  const muzzle = along > 0.93 ? (along - 0.93) / 0.07 : 0;
  color
    .copy(BELLY)
    .lerp(BACK, back)
    .multiplyScalar((0.78 + 0.44 * scars) * (1 - 0.3 * muzzle));
};

/** The folds of a dugong's neck and the crease behind each flipper. */
const relief: Loft["relief"] = (along) =>
  along > 0.6 && along < 0.82 ? 0.018 * Math.sin(along * 2 * Math.PI * 22) : 0;

/**
 * A dugong (Dugong dugon) as one body: its trunk, two paddle flippers set
 * low behind the head, and the notched, whale-like fluke that tells it from
 * a manatee. It has no dorsal fin.
 */
export function dugongForms(detail: number): readonly Form[] {
  const trunk = loftBody({
    along: faces(96, detail),
    around: faces(72, detail),
    belly: 0.12,
    lump: 0.05,
    paint,
    relief,
    seed: 3,
    square: 2.2,
    stations: SPINE,
    up: [0, 1, 0],
  });
  const flipper = finBody({
    along: faces(20, detail),
    around: faces(16, detail),
    chord: 0.085,
    paint,
    span: 0.17,
    sweep: 0.05,
    thick: 0.024,
  });
  const fluke = finBody({
    along: faces(24, detail),
    around: faces(16, detail),
    chord: 0.13,
    paint,
    span: 0.2,
    sweep: 0.085,
    thick: 0.022,
  });
  return [
    trunk,
    attachForm(flipper, [0.2, -0.075, 0.1], [-0.42, -0.5, 0.75], [1, 0, 0]),
    attachForm(flipper, [0.2, -0.075, -0.1], [-0.42, -0.5, -0.75], [1, 0, 0]),
    attachForm(fluke, [-0.425, 0.004, 0.008], [-0.3, 0, 1], [1, 0, 0]),
    attachForm(fluke, [-0.425, 0.004, -0.008], [-0.3, 0, -1], [1, 0, 0]),
  ];
}
