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

const BACK = new Color(CLASSIFICATION_COLORS.whale);
const BELLY = new Color(CLASSIFICATION_COLORS.whaleBelly);

/** How many throat pleats run from a Bryde's whale's chin to its navel. */
const PLEATS = 44;

/**
 * The sections of a Bryde's whale from the tail stock to the tip of the
 * snout, head towards +x: a slender rorqual, deepest at the throat, with a
 * long flat pointed head and a tail stock that is tall and narrow.
 */
const SPINE: readonly Station[] = [
  { centre: [-0.7, 0.01, 0], tall: 0, wide: 0 },
  { centre: [-0.66, 0.01, 0], tall: 0.03, wide: 0.011 },
  { centre: [-0.5, 0.01, 0], tall: 0.058, wide: 0.03 },
  { centre: [-0.3, 0.006, 0], tall: 0.094, wide: 0.07 },
  { centre: [-0.08, 0, 0], tall: 0.118, wide: 0.104 },
  { centre: [0.14, -0.006, 0], tall: 0.124, wide: 0.118 },
  { centre: [0.34, -0.012, 0], tall: 0.114, wide: 0.114 },
  { centre: [0.5, -0.018, 0], tall: 0.084, wide: 0.096 },
  { centre: [0.62, -0.024, 0], tall: 0.05, wide: 0.064 },
  { centre: [0.69, -0.028, 0], tall: 0.022, wide: 0.028 },
  { centre: [0.706, -0.03, 0], tall: 0, wide: 0 },
];

/** How much of the throat a place lies in: 1 under the chin and chest, 0 on the back and the tail. */
function throat(along: number, around: number) {
  const under = Math.min(1, Math.max(0, (0.21 - Math.abs(around - 0.5)) * 14));
  const fore = Math.min(1, Math.max(0, (along - 0.42) * 8));
  const chin = Math.min(1, Math.max(0, (0.97 - along) * 20));
  return under * fore * chin;
}

/** How deep in a throat pleat's groove a place lies, from 0 on a ridge to 1. */
function groove(around: number) {
  return (0.5 - 0.5 * Math.cos(around * 2 * Math.PI * PLEATS * 1.5)) ** 3;
}

/**
 * The relief of a Bryde's whale: the pleats that let its throat balloon
 * when it gulps, and the three ridges along the top of its snout that no
 * other rorqual has.
 */
const relief: Loft["relief"] = (along, around) => {
  const top = Math.min(around, 1 - around);
  const ridges =
    along > 0.74
      ? Math.max(0, 1 - Math.abs(top) * 60) +
        Math.max(0, 1 - Math.abs(top - 0.06) * 60)
      : 0;
  return 0.05 * ridges - 0.022 * throat(along, around) * groove(around);
};

/**
 * A Bryde's whale's colour at a place: smoky blue-grey above, pale below
 * with darker pleat grooves, and the dark line of its mouth along the head.
 */
const paint: Loft["paint"] = (along, around, color) => {
  const back = Math.min(1, Math.max(0, dorsal(around) * 2.4 - 0.55));
  const mottle = fractalAt(along, around, 12, 6, 67, 3);
  const jaw = Math.abs(Math.abs(around - 0.5) - 0.2 - 0.06 * (along - 0.74));
  const mouth = along > 0.74 && along < 0.99 && jaw < 0.008 ? 0.45 : 1;
  color
    .copy(BELLY)
    .lerp(BACK, back)
    .multiplyScalar(
      (0.84 + 0.32 * mottle) *
        (1 - 0.1 * throat(along, around) * groove(around)) *
        mouth
    );
};

/**
 * A Bryde's whale (Balaenoptera edeni) as one body: its trunk with throat
 * pleats and snout ridges, two slim pointed flippers, the small hooked
 * dorsal fin set two thirds of the way back, and broad notched flukes.
 */
export function whaleForms(detail: number): readonly Form[] {
  const trunk = loftBody({
    along: faces(120, detail),
    around: faces(264, detail),
    belly: 0.06,
    lump: 0.03,
    paint,
    relief,
    seed: 7,
    square: 2.15,
    stations: SPINE,
    up: [0, 1, 0],
  });
  const flipper = finBody({
    along: faces(20, detail),
    around: faces(16, detail),
    chord: 0.056,
    paint,
    span: 0.2,
    sweep: 0.06,
    thick: 0.014,
  });
  const fin = finBody({
    along: faces(16, detail),
    around: faces(16, detail),
    chord: 0.085,
    paint,
    span: 0.07,
    sweep: 0.06,
    thick: 0.012,
  });
  const fluke = finBody({
    along: faces(24, detail),
    around: faces(16, detail),
    chord: 0.11,
    paint,
    span: 0.22,
    sweep: 0.09,
    thick: 0.016,
  });
  return [
    trunk,
    attachForm(flipper, [0.36, -0.08, 0.1], [-0.55, -0.4, 0.73], [1, 0, 0]),
    attachForm(flipper, [0.36, -0.08, -0.1], [-0.55, -0.4, -0.73], [1, 0, 0]),
    attachForm(fin, [-0.31, 0.092, 0], [-0.35, 1, 0], [1, 0, 0]),
    attachForm(fluke, [-0.665, 0.01, 0.004], [-0.28, 0, 1], [1, 0, 0]),
    attachForm(fluke, [-0.665, 0.01, -0.004], [-0.28, 0, -1], [1, 0, 0]),
  ];
}
