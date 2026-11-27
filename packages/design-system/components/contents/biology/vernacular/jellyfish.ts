import { faces } from "@repo/design-system/components/three/organism/budget";
import type { Form } from "@repo/design-system/components/three/organism/form";
import type {
  Loft,
  Station,
} from "@repo/design-system/components/three/organism/loft";
import { loftBody } from "@repo/design-system/components/three/organism/loft";
import type { Mound } from "@repo/design-system/components/three/organism/mound";
import { moundBody } from "@repo/design-system/components/three/organism/mound";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr } from "effect";
import { Color } from "three";

const BELL = new Color(CLASSIFICATION_COLORS.jellyBell);
const TINT = new Color(CLASSIFICATION_COLORS.jellyfish);
const GONAD = new Color(CLASSIFICATION_COLORS.jellyGonad);

/** The bell's radius, in scene units. */
export const BELL_RADIUS = 0.2;

/** How many lappets scallop the bell's margin. */
const LAPPETS = 8;

/** How many radial canals run from the stomach to the margin. */
const CANALS = 16;

/** The bell's outline: a saucer scalloped into eight shallow lappets. */
const rim: Mound["rim"] = (turn) =>
  BELL_RADIUS * (1 + 0.03 * Math.cos(turn * 2 * Math.PI * LAPPETS));

/** The height of the bell's upper face: a shallow saucer that turns down at its margin. */
function crown(out: number) {
  return 0.09 * (1 - out * out) ** 0.6 - 0.012 * out ** 6;
}

/**
 * The bell's colour at a place: clear, milky jelly, with the fine radial
 * canals that carry food to the margin and a faint violet rim.
 */
const paint: Mound["paint"] = (out, turn, color) => {
  const canal =
    out > 0.3 ? (0.5 + 0.5 * Math.cos(turn * 2 * Math.PI * CANALS)) ** 12 : 0;
  color.copy(BELL).lerp(TINT, 0.25 + 0.5 * out ** 4 + 0.4 * canal);
};

/** The four horseshoe gonads and oral arms share the animal's violet. */
const inner: Loft["paint"] = (along, _around, color) => {
  color.copy(GONAD).lerp(TINT, 0.6 * along);
};

/** One horseshoe gonad, open towards the bell's middle, in the quarter that `quarter` names. */
function gonad(quarter: number, detail: number) {
  const middle = ((quarter + 0.5) / 4) * 2 * Math.PI;
  const stations = Arr.makeBy(12, (step): Station => {
    const bend = middle + Math.PI + (0.12 + (0.76 * step) / 11) * 2 * Math.PI;
    const girth = step === 0 || step === 11 ? 0 : 0.011;
    return {
      centre: [
        0.085 * Math.cos(middle) + 0.04 * Math.cos(bend),
        0.052,
        0.085 * Math.sin(middle) + 0.04 * Math.sin(bend),
      ],
      tall: girth * 0.7,
      wide: girth,
    };
  });
  return loftBody({
    along: faces(40, detail),
    around: faces(10, detail),
    belly: 0,
    lump: 0.2,
    paint: (_along, _around, color) => {
      color.copy(GONAD);
    },
    relief: () => 0,
    seed: 17 + quarter,
    square: 2,
    stations,
    up: [0, 1, 0],
  });
}

/** One frilled oral arm, hanging from the mouth and trailing outwards in the quarter that `quarter` names. */
function arm(quarter: number, detail: number) {
  const turn = (quarter / 4) * 2 * Math.PI;
  const reach = (out: number, drop: number): Station["centre"] => [
    out * Math.cos(turn),
    drop,
    out * Math.sin(turn),
  ];
  return loftBody({
    along: faces(120, detail),
    around: faces(12, detail),
    belly: 0,
    lump: 0.1,
    paint: inner,
    relief: (along, around) =>
      0.45 *
      Math.sin(along * 2 * Math.PI * 14 + 3 * Math.sin(along * 23)) *
      Math.abs(Math.sin(around * 2 * Math.PI)),
    seed: 23 + quarter,
    square: 2,
    stations: [
      { centre: reach(0.004, 0.045), tall: 0, wide: 0 },
      { centre: reach(0.012, 0.02), tall: 0.005, wide: 0.012 },
      { centre: reach(0.04, -0.04), tall: 0.004, wide: 0.02 },
      { centre: reach(0.075, -0.11), tall: 0.004, wide: 0.018 },
      { centre: reach(0.095, -0.18), tall: 0.003, wide: 0.012 },
      { centre: reach(0.1, -0.23), tall: 0, wide: 0 },
    ],
    up: [Math.cos(turn), 0.4, Math.sin(turn)],
  });
}

/**
 * A moon jellyfish (Aurelia aurita) as one body: its saucer bell, upper
 * and lower face, the four horseshoe gonads that show through it, and the
 * four frilled oral arms under its mouth. The fringe of marginal tentacles
 * is `tentacleForms`, drawn many times round the margin.
 */
export function jellyfishForms(detail: number): readonly Form[] {
  const rings = faces(40, detail);
  const spokes = faces(128, detail);
  return [
    moundBody({
      height: (out) => crown(out) - 0.004 - 0.034 * (1 - out * out),
      paint,
      rim,
      rings,
      spokes,
    }),
    ...Arr.makeBy(4, (quarter) => gonad(quarter, detail)),
    ...Arr.makeBy(4, (quarter) => arm(quarter, detail)),
    moundBody({ height: crown, paint, rim, rings, spokes }),
  ];
}

/**
 * One marginal tentacle, a unit long along x and tapering to nothing, for
 * the fringe that hangs from the bell's margin.
 */
export function tentacleForms(detail: number): readonly Form[] {
  return [
    loftBody({
      along: faces(12, detail),
      around: 6,
      belly: 0,
      lump: 0,
      paint: inner,
      relief: () => 0,
      seed: 29,
      square: 2,
      stations: [
        { centre: [0, 0, 0], tall: 0.0016, wide: 0.0016 },
        { centre: [0.4, 0, 0.03], tall: 0.0012, wide: 0.0012 },
        { centre: [0.8, 0, -0.02], tall: 0.0008, wide: 0.0008 },
        { centre: [1, 0, 0], tall: 0, wide: 0 },
      ],
      up: [0, 1, 0],
    }),
  ];
}
