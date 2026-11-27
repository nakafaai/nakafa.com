import {
  fractalAt,
  ridgedAt,
} from "@repo/design-system/components/three/field/noise";
import { faces } from "@repo/design-system/components/three/organism/budget";
import type { Form } from "@repo/design-system/components/three/organism/form";
import { attachForm } from "@repo/design-system/components/three/organism/form";
import type { Station } from "@repo/design-system/components/three/organism/loft";
import {
  loftBody,
  ovoid,
} from "@repo/design-system/components/three/organism/loft";
import { moundBody } from "@repo/design-system/components/three/organism/mound";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { Array as Arr } from "effect";
import { CatmullRomCurve3, Color, Vector3 } from "three";

const WALL = new Color(BIOLOGY_COLORS.tubule);
const PALE = new Color(BIOLOGY_COLORS.tubuleLumen);
const PINK = new Color(BIOLOGY_COLORS.tissuePink);
const DEEP = new Color(BIOLOGY_COLORS.tissueDeep);
const BLOOD = new Color(BIOLOGY_COLORS.blood);
const VEIN = new Color(BIOLOGY_COLORS.bloodDark);

/** A point of the nephron's drawing, in its own units of about a tenth of a millimetre. */
type Point = readonly [number, number, number];

/** Builds a smooth curve through `points`. */
export function curve(points: readonly Point[]) {
  return new CatmullRomCurve3(
    Arr.map(points, (point) => new Vector3(...point)),
    false,
    "centripetal"
  );
}

/** Where the Bowman's capsule sits. */
const CAPSULE: Point = [-1.6, 1.6, 0];

/**
 * The path filtrate takes, from the capsule through the proximal convoluted
 * tubule, down the loop of Henle into the medulla and back up, through the
 * distal convoluted tubule, and down the collecting duct.
 */
export const TUBULE: readonly Point[] = [
  [-1.6, 1.15, 0],
  [-1.15, 0.95, 0.35],
  [-0.7, 1.35, 0.5],
  [-0.95, 1.85, 0.1],
  [-0.45, 2.1, -0.35],
  [0, 1.7, -0.2],
  [-0.3, 1.25, 0.15],
  [0.15, 0.95, 0.3],
  [0.35, 0.3, 0.1],
  [0.38, -0.8, 0],
  [0.42, -1.9, 0],
  [0.62, -2.35, 0],
  [0.85, -1.9, 0],
  [0.9, -0.8, 0],
  [0.92, 0.6, -0.1],
  [0.6, 1.25, 0.45],
  [0.25, 1.55, 0.2],
  [0.7, 1.95, -0.2],
  [1.25, 1.75, 0],
  [1.7, 1.5, 0],
  [1.75, 0.2, 0],
  [1.75, -1.2, 0],
  [1.75, -2.8, 0],
];

/** The blood: in along the afferent arteriole, round the glomerulus, out along the efferent one, and alongside the tubule. */
const AFFERENT: readonly Point[] = [
  [-3.2, 2.4, 0.2],
  [-2.3, 1.9, 0.1],
  [-1.85, 1.7, 0.05],
];
export const EFFERENT: readonly Point[] = [
  [-1.4, 1.95, -0.1],
  [-1.0, 2.35, -0.5],
  [-0.4, 2.45, -0.75],
  [0.2, 2.1, -0.6],
  [0.25, 1.2, -0.3],
  [0.15, 0.4, -0.25],
  [0.1, -1.2, -0.3],
  [0.62, -2.6, -0.35],
  [1.15, -1.2, -0.3],
  [1.2, 0.6, -0.4],
  [2.4, 1.4, -0.5],
];

/** How far a value has passed an edge, from 0 just before it to 1 just after: a soft border. */
function blend(value: number, edge: number) {
  return Math.min(1, Math.max(0, (value - edge) * 40 + 0.5));
}

/**
 * How wide the tubule is at a share of its length: the thick proximal
 * tubule, the thin limb that dives into the medulla, the thicker limb that
 * climbs back, the distal tubule, and the collecting duct that widens as it
 * gathers urine.
 */
export function tubuleRadius(share: number) {
  const thin = blend(share, 0.36) - blend(share, 0.52);
  const duct = blend(share, 0.82);
  return 0.135 - 0.065 * thin - 0.02 * blend(share, 0.52) + 0.05 * duct * share;
}

/** The sections of a vessel or tubule sampled evenly along a curve, each as wide as `radius` says. */
function along(
  path: CatmullRomCurve3,
  count: number,
  radius: (share: number) => number
): readonly Station[] {
  const point = new Vector3();
  return Arr.makeBy(count, (step): Station => {
    const share = step / (count - 1);
    path.getPointAt(share, point);
    return {
      centre: [point.x, point.y, point.z],
      tall: radius(share),
      wide: radius(share),
    };
  });
}

/** How far a place on a cut face lies from the middle of the face towards its edge, from -1 to 1. */
function across(around: number) {
  return Math.sin(around * 2 * Math.PI);
}

/**
 * The renal tubule cut open along its length towards the viewer, so the
 * filtrate shows in its lumen: a wall one cell thick, tall and rosy with a
 * brush border where it reabsorbs, flat and pale in the thin limb.
 */
export function tubuleForms(detail: number): readonly Form[] {
  return [
    loftBody({
      along: faces(900, detail),
      around: faces(28, detail),
      belly: 1,
      lump: 0.04,
      paint: (share, around, color) => {
        const thin = blend(share, 0.36) - blend(share, 0.52);
        const cells = ridgedAt(share, around, 300, 3, 251, 2);
        color.copy(PINK).lerp(WALL, 0.25 + 0.5 * thin);
        if (around < 0.25 || around > 0.75) {
          color.lerp(DEEP, 0.3 * cells);
          return;
        }
        const off = Math.abs(across(around));
        const lumen = 1 - blend(off, 0.5 - 0.12 * (1 - thin));
        const nuclei = blend(fractalAt(share, 0.5, 420, 1, 255, 1), 0.62);
        color
          .lerp(DEEP, 0.55 * nuclei * blend(off, 0.6) * (1 - lumen))
          .lerp(PALE, lumen)
          .lerp(WALL, 0.4 * lumen * (1 - off * 2))
          .lerp(DEEP, 0.35 * blend(off, 0.94));
      },
      relief: (share, around) =>
        0.04 * Math.sin(share * 2 * Math.PI * 150 + 3 * Math.sin(around * 12)),
      seed: 253,
      square: 2.2,
      stations: along(curve(TUBULE), 180, tubuleRadius),
      steady: true,
      up: [0, 0, -1],
    }),
  ];
}

/** The glomerulus as a tuft of capillary loops, wound into a ball `radius` across about the middle of the capsule. */
function tuft(radius: number): readonly Station[] {
  return Arr.makeBy(160, (step): Station => {
    const turn = (step / 159) * 2 * Math.PI;
    const reach = radius * (0.58 + 0.42 * Math.sin(turn * 11));
    return {
      centre: [
        CAPSULE[0] + reach * Math.cos(turn * 5) * Math.cos(turn * 1.5),
        CAPSULE[1] + reach * Math.sin(turn * 5) * Math.cos(turn * 1.5),
        CAPSULE[2] + 0.06 + reach * Math.sin(turn * 1.5) * 0.7,
      ],
      tall: 0.05,
      wide: 0.05,
    };
  });
}

/**
 * The blood vessels of a nephron: the afferent arteriole, the glomerulus it
 * feeds, and the narrower efferent arteriole that runs on as the capillaries
 * beside the tubule.
 */
export function vesselForms(detail: number): readonly Form[] {
  const vessel = (
    stations: readonly Station[],
    rings: number,
    tone: Color,
    seed: number
  ) =>
    loftBody({
      along: faces(rings, detail),
      around: faces(14, detail),
      belly: 0,
      lump: 0.08,
      paint: (share, around, color) => {
        color
          .copy(tone)
          .multiplyScalar(0.78 + 0.4 * fractalAt(share, around, 60, 4, seed, 2));
      },
      relief: () => 0,
      seed,
      square: 2,
      stations,
      up: [0, 0, 1],
    });
  return [
    vessel(
      along(curve(AFFERENT), 24, () => 0.085),
      48,
      BLOOD,
      257
    ),
    vessel(tuft(0.36), 640, BLOOD, 259),
    vessel(
      along(curve(EFFERENT), 110, (share) => 0.06 - 0.015 * share),
      300,
      VEIN,
      261
    ),
  ];
}

/**
 * Bowman's capsule cut open towards the viewer: the thin outer wall, and
 * inside it the urinary space that catches what the glomerulus filters and
 * drains into the tubule below.
 */
export function capsuleForms(detail: number): readonly Form[] {
  return [
    loftBody({
      along: faces(96, detail),
      around: faces(120, detail),
      belly: 1,
      lump: 0.03,
      paint: (share, around, color) => {
        const grain = fractalAt(share, around, 20, 20, 263, 3);
        color.copy(PINK).lerp(WALL, 0.3 + 0.4 * grain);
        if (around < 0.25 || around > 0.75) {
          return;
        }
        const from = Math.hypot(2 * share - 1, across(around));
        color
          .copy(PALE)
          .lerp(DEEP, 0.5 * (1 - from) ** 2)
          .lerp(PINK, blend(from, 0.86))
          .lerp(DEEP, 0.4 * blend(from, 0.97));
      },
      relief: () => 0,
      seed: 265,
      square: 2,
      stations: ovoid([CAPSULE[0], CAPSULE[1], -0.34], 1.12, 0.56, 0.3, 0),
      up: [0, 0, -1],
    }),
  ];
}

/** How far the slice of kidney reaches from its middle at a turn round it: a rounded block. */
function outline(turn: number) {
  const angle = turn * 2 * Math.PI;
  return (
    (Math.abs(Math.cos(angle) / 3.9) ** 6 +
      Math.abs(Math.sin(angle) / 3.3) ** 6) **
    (-1 / 6)
  );
}

/**
 * The slice of kidney the nephron lies in, its cut face towards the viewer:
 * the grainy cortex above, dotted with renal corpuscles, where the capsule
 * and the coiled tubules sit, and the darker, rayed medulla below, which the
 * loop of Henle and the collecting duct run down into.
 */
export function kidneyForms(detail: number): readonly Form[] {
  const slice = moundBody({
    height: (out) => 0.22 * (1 - out ** 14),
    paint: (out, turn, color) => {
      const reach = out * outline(turn);
      const across = 0.5 + (reach * Math.cos(turn * 2 * Math.PI)) / 8;
      const down = 0.5 + (reach * Math.sin(turn * 2 * Math.PI)) / 8;
      const grain = fractalAt(across, down, 70, 70, 269, 3);
      const border =
        0.43 +
        0.02 * Math.cos(across * 2 * Math.PI * 5.5) +
        0.02 * fractalAt(across, 0.5, 9, 1, 267, 2);
      const medulla = blend(down, border);
      const rays = ridgedAt(across, 0.5, 40, 1, 271, 3);
      const corpuscles = blend(fractalAt(across, down, 46, 46, 275, 1), 0.71);
      color
        .copy(PINK)
        .lerp(WALL, 0.15 + 0.3 * grain)
        .lerp(DEEP, 0.45 * corpuscles * (1 - medulla))
        .lerp(DEEP, medulla * (0.55 + 0.35 * rays))
        .lerp(VEIN, medulla * 0.25 * rays * grain)
        .lerp(PALE, 0.5 * blend(out, 0.975));
    },
    rim: outline,
    rings: faces(150, detail),
    spokes: faces(360, detail),
  });
  return [attachForm(slice, [0, -0.2, -1.08], [1, 0, 0], [0, 0, 1])];
}
