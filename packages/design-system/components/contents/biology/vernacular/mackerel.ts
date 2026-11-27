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
import { Array as Arr } from "effect";
import { Color } from "three";

const BACK = new Color(CLASSIFICATION_COLORS.mackerelBack);
const BAND = new Color(CLASSIFICATION_COLORS.mackerelBand);
const FLANK = new Color(CLASSIFICATION_COLORS.mackerel);
const GOLD = new Color(CLASSIFICATION_COLORS.mackerelGold);
const BELLY = new Color(CLASSIFICATION_COLORS.mackerelBelly);
const FIN = new Color(CLASSIFICATION_COLORS.mackerelFin);

/**
 * The sections of an Indian mackerel from the tail stock to the snout, head
 * towards +x: a deep spindle pressed flat from side to side, with a narrow
 * tail stock and a pointed head.
 */
const SPINE: readonly Station[] = [
  { centre: [-0.285, 0, 0], tall: 0, wide: 0 },
  { centre: [-0.27, 0, 0], tall: 0.012, wide: 0.005 },
  { centre: [-0.2, 0, 0], tall: 0.027, wide: 0.014 },
  { centre: [-0.1, 0, 0], tall: 0.054, wide: 0.03 },
  { centre: [0, 0, 0], tall: 0.072, wide: 0.04 },
  { centre: [0.1, 0, 0], tall: 0.076, wide: 0.042 },
  { centre: [0.19, 0, 0], tall: 0.065, wide: 0.038 },
  { centre: [0.26, -0.002, 0], tall: 0.042, wide: 0.027 },
  { centre: [0.3, -0.005, 0], tall: 0.016, wide: 0.011 },
  { centre: [0.31, -0.006, 0], tall: 0, wide: 0 },
];

/**
 * An Indian mackerel's colour at a place: a dark blue-green back crossed by
 * narrow dark bands, a gold sheen along the flank, a silver-white belly, the
 * dark edge of the gill cover and the black spot behind the pectoral fin.
 */
const paint: Loft["paint"] = (along, around, color) => {
  const back = dorsal(around);
  const bands = back > 0.6 && back < 0.93 && along < 0.74;
  const band = bands ? 0.5 + 0.5 * Math.cos(back * 2 * Math.PI * 9) : 0;
  const gill = Math.abs(along - 0.75 - 0.05 * (back - 0.5) ** 2) < 0.006;
  const spot = Math.hypot((along - 0.66) * 2.5, back - 0.42) < 0.045;
  color
    .copy(BELLY)
    .lerp(GOLD, Math.max(0, 1 - Math.abs(back - 0.5) * 5) * 0.7)
    .lerp(FLANK, Math.min(1, Math.max(0, (back - 0.5) * 6)))
    .lerp(BACK, Math.min(1, Math.max(0, (back - 0.66) * 5)))
    .lerp(BAND, band ** 3 * 0.85)
    .multiplyScalar(gill && back > 0.15 && back < 0.9 ? 0.6 : 1)
    .multiplyScalar(spot ? 0.25 : 1);
};

/** The dusky, translucent grey of a mackerel's fins, darker towards the tips. */
const finPaint: Loft["paint"] = (along, _around, color) => {
  color.copy(FIN).multiplyScalar(1 - 0.45 * along);
};

/** Where the five finlets stand between the second dorsal fin and the tail. */
const FINLETS = [-0.13, -0.158, -0.186, -0.214, -0.242] as const;

/**
 * An Indian mackerel (Rastrelliger kanagurta) as one body: its trunk, the
 * spiny first dorsal fin, the second dorsal and the anal fin, five finlets
 * behind each, a deeply forked tail, and the paired pectoral and pelvic
 * fins.
 */
export function mackerelForms(detail: number): readonly Form[] {
  const trunk = loftBody({
    along: faces(72, detail),
    around: faces(128, detail),
    belly: 0,
    lump: 0.015,
    paint,
    relief: () => 0,
    seed: 11,
    square: 2,
    stations: SPINE,
    up: [0, 1, 0],
  });
  const blade = (span: number, chord: number, sweep: number) =>
    finBody({
      along: faces(12, detail),
      around: faces(10, detail),
      chord,
      paint: finPaint,
      span,
      sweep,
      thick: 0.004,
    });
  const tail = blade(0.105, 0.04, 0.02);
  const first = blade(0.06, 0.075, 0.05);
  const second = blade(0.03, 0.05, 0.035);
  const finlet = blade(0.012, 0.016, 0.01);
  const pectoral = blade(0.06, 0.03, 0.012);
  const pelvic = blade(0.035, 0.024, 0.014);
  return [
    trunk,
    attachForm(tail, [-0.268, 0.004, 0], [-0.62, 0.78, 0], [0.78, 0.62, 0]),
    attachForm(tail, [-0.268, -0.004, 0], [-0.62, -0.78, 0], [0.78, -0.62, 0]),
    attachForm(first, [0.1, 0.07, 0], [-0.3, 1, 0], [1, 0, 0]),
    attachForm(second, [-0.07, 0.05, 0], [-0.4, 1, 0], [1, 0, 0]),
    attachForm(second, [-0.07, -0.05, 0], [-0.4, -1, 0], [1, 0, 0]),
    ...Arr.flatMap(FINLETS, (x) => {
      const high = 0.036 + (x + 0.13) * 0.19;
      return [
        attachForm(finlet, [x, high, 0], [-0.5, 1, 0], [1, 0, 0]),
        attachForm(finlet, [x, -high, 0], [-0.5, -1, 0], [1, 0, 0]),
      ];
    }),
    attachForm(pectoral, [0.17, -0.004, 0.038], [-0.85, -0.25, 0.45], [0, 1, 0]),
    attachForm(pectoral, [0.17, -0.004, -0.038], [-0.85, -0.25, -0.45], [0, 1, 0]),
    attachForm(pelvic, [0.13, -0.066, 0.012], [-0.7, -0.6, 0.3], [1, 0, 0]),
    attachForm(pelvic, [0.13, -0.066, -0.012], [-0.7, -0.6, -0.3], [1, 0, 0]),
  ];
}
