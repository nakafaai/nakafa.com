import {
  cellsAt,
  fractalAt,
} from "@repo/design-system/components/three/field/noise";
import { faces } from "@repo/design-system/components/three/organism/budget";
import type { Form } from "@repo/design-system/components/three/organism/form";
import type { Station } from "@repo/design-system/components/three/organism/loft";
import {
  duct,
  loftBody,
} from "@repo/design-system/components/three/organism/loft";
import { shellBody } from "@repo/design-system/components/three/organism/shell";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { Array as Arr } from "effect";
import { Color } from "three";

const IVORY = new Color(SKELETON_COLORS.bone);
const SOFT = new Color(SKELETON_COLORS.boneSoft);
const SPONGY = new Color(SKELETON_COLORS.spongyPorous);
const MARROW = new Color(SKELETON_COLORS.marrow);

/** A quarter turn and a full turn, in radians. */
const QUARTER = Math.PI / 2;
const TURN = 2 * Math.PI;

/**
 * The colour of living compact bone at a place: ivory, mottled where it is
 * thinner, and pitted with the small holes its vessels enter by.
 */
function compact(color: Color, x: number, y: number, seed: number) {
  const mottle = fractalAt(x, y, 9, 5, seed, 4);
  const pit = cellsAt(x, y, 70, 36, seed + 1).nearest < 0.16 ? 0.84 : 1;
  color
    .copy(SOFT)
    .lerp(IVORY, 0.3 + 0.7 * mottle)
    .multiplyScalar(pit);
}

/**
 * The colour of spongy bone where a bone is cut: a lattice of pale struts
 * round pores full of red marrow.
 */
function spongy(color: Color, x: number, y: number, seed: number) {
  const cell = cellsAt(x, y, 90, 40, seed);
  color.copy(MARROW).lerp(SPONGY, cell.second - cell.nearest < 0.22 ? 1 : 0.25);
}

/**
 * One bone lofted over its sections, ivory all over and showing its marrow
 * where `cut` says the bone was sawn through, as a share of its length from
 * each end.
 */
function bone(
  stations: readonly Station[],
  seed: number,
  detail: number,
  cut: readonly [number, number] = [0, 0]
): Form {
  return loftBody({
    along: faces(120, detail),
    around: faces(40, detail),
    belly: 0,
    lump: 0.05,
    paint: (along, around, color) => {
      if (along < cut[0] || along > 1 - cut[1]) {
        spongy(color, around, along * 6, seed);
        return;
      }
      compact(color, along, around, seed);
    },
    relief: () => 0,
    seed,
    square: 2.3,
    stations,
    up: [0, 1, 0],
  });
}

/** The sections of a bone in the plane of the joint: where its middle runs, its half-height and its half-breadth. */
function sections(
  rows: readonly (readonly [number, number, number, number, number])[]
): readonly Station[] {
  return Arr.map(
    rows,
    ([x, y, z, tall, wide]): Station => ({ centre: [x, y, z], tall, wide })
  );
}

/**
 * The lower end of the humerus at the elbow, sawn through its shaft: the
 * shaft flattens and broadens into its two epicondyles and ends in the
 * trochlea, a spool that turns about the joint's own axis at the origin.
 */
export function humerusForms(detail: number): readonly Form[] {
  return [
    bone(
      sections([
        [-0.66, 0, 0, 0, 0],
        [-0.65, 0, 0, 0.05, 0.05],
        [-0.52, 0, 0, 0.054, 0.054],
        [-0.4, 0, 0, 0.05, 0.056],
        [-0.28, 0, 0, 0.048, 0.072],
        [-0.17, 0, 0, 0.044, 0.105],
        [-0.09, 0, 0, 0.05, 0.145],
        [-0.04, 0, 0, 0.074, 0.13],
        [0, 0, 0, 0.084, 0.125],
        [0.04, 0, 0, 0.074, 0.125],
        [0.07, 0, 0, 0.046, 0.11],
        [0.084, 0, 0, 0, 0],
      ]),
      11,
      detail,
      [0.03, 0]
    ),
  ];
}

/**
 * The ulna and the radius of the forearm, sawn through their shafts. The
 * ulna's olecranon hooks behind the trochlea and its coronoid process stands
 * in front, so the notch between them turns about the origin; the radius
 * lies beside it with its round head against the humerus.
 */
export function forearmForms(detail: number): readonly Form[] {
  return [
    bone(
      sections([
        [-0.075, -0.16, -0.02, 0, 0],
        [-0.055, -0.163, -0.02, 0.034, 0.05],
        [0, -0.152, -0.02, 0.044, 0.06],
        [0.07, -0.128, -0.02, 0.04, 0.06],
        [0.13, -0.075, -0.02, 0.048, 0.055],
        [0.165, -0.025, -0.025, 0.05, 0.048],
        [0.26, -0.012, -0.035, 0.038, 0.04],
        [0.4, -0.005, -0.04, 0.032, 0.032],
        [0.54, 0, -0.04, 0.03, 0.03],
        [0.65, 0, -0.04, 0.03, 0.032],
        [0.66, 0, -0.04, 0, 0],
      ]),
      13,
      detail,
      [0, 0.03]
    ),
    bone(
      sections([
        [0.102, 0, 0.085, 0, 0],
        [0.108, 0, 0.085, 0.04, 0.04],
        [0.135, 0, 0.085, 0.044, 0.044],
        [0.16, 0, 0.085, 0.03, 0.03],
        [0.21, 0.004, 0.085, 0.036, 0.03],
        [0.3, 0, 0.08, 0.026, 0.027],
        [0.44, 0, 0.07, 0.027, 0.028],
        [0.56, 0, 0.065, 0.028, 0.03],
        [0.65, 0, 0.06, 0.03, 0.032],
        [0.66, 0, 0.06, 0, 0],
      ]),
      17,
      detail,
      [0, 0.03]
    ),
  ];
}

/** Where the biceps tendon grips the radius, in the forearm's own frame. */
export const ELBOW_INSERTION = [0.215, 0.04, 0.085] as const;

/**
 * The shoulder blade at the shoulder: the shallow cup of its socket, facing
 * +x round the origin, on the neck and the thin flat blade behind it.
 */
export function scapulaForms(detail: number): readonly Form[] {
  return [
    shellBody({
      across: [Math.PI - 0.82, Math.PI + 0.82],
      along: [-0.9, 0.9],
      columns: faces(28, detail),
      edge: () => [0, 0],
      lump: 0.2,
      paint: (along, across, _side, color) => {
        compact(color, along, across, 23);
      },
      radius: 0.16,
      rows: faces(40, detail),
      seed: 23,
      thick: 0.05,
    }),
    bone(
      sections([
        [-0.15, 0, 0, 0, 0],
        [-0.165, 0, 0, 0.11, 0.085],
        [-0.25, 0, 0, 0.08, 0.06],
        [-0.36, -0.01, 0, 0.085, 0.045],
        [-0.46, -0.05, -0.01, 0.16, 0.028],
        [-0.56, -0.09, -0.02, 0.23, 0.018],
        [-0.66, -0.12, -0.03, 0.2, 0.014],
        [-0.7, -0.13, -0.03, 0, 0],
      ]),
      29,
      detail
    ),
  ];
}

/**
 * The upper end of the humerus at the shoulder, sawn through its shaft: a
 * ball of a head about the origin, a narrow neck, the tubercles its muscles
 * grip, and the shaft.
 */
export function ballForms(detail: number): readonly Form[] {
  return [
    bone(
      sections([
        [-0.112, 0, 0, 0, 0],
        [-0.1, 0, 0, 0.05, 0.05],
        [-0.07, 0, 0, 0.087, 0.087],
        [-0.03, 0, 0, 0.108, 0.108],
        [0, 0, 0, 0.112, 0.112],
        [0.04, 0, 0, 0.105, 0.105],
        [0.085, 0, 0, 0.082, 0.082],
        [0.14, 0.008, 0, 0.092, 0.088],
        [0.22, 0, 0, 0.07, 0.068],
        [0.34, 0, 0, 0.056, 0.056],
        [0.5, 0, 0, 0.052, 0.052],
        [0.65, 0, 0, 0.05, 0.05],
        [0.66, 0, 0, 0, 0],
      ]),
      31,
      detail,
      [0, 0.03]
    ),
  ];
}

/** Where the muscle's tendon grips the humerus at the shoulder, in the humerus's own frame. */
export const SHOULDER_INSERTION = [0.15, 0.096, 0] as const;

/** How far a skull suture's edge strays at a place along it, in radians: irregular interlocking teeth. */
function serration(along: number) {
  const tooth = Math.abs(((along * 17) % 1) - 0.5) * 4 - 1;
  return (
    0.028 * tooth +
    0.03 * (fractalAt(along, 0.5, 40, 1, 61, 3) - 0.5) +
    0.012 * Math.sin(along * 97)
  );
}

/** Half the gap between the two bones of a suture, in radians, and each bone's breadth. */
const SEAM = 0.012;
const PLATE = 0.44;

/**
 * One flat bone of the skull's vault on its side of a suture, sawn out of
 * the skull: two tables of compact bone with spongy bone between them at
 * its cut edges, and a serrated edge that locks into its neighbour's.
 */
function vaultBone(side: 1 | -1, detail: number): Form {
  const near = QUARTER + side * SEAM;
  const far = QUARTER + side * (SEAM + PLATE);
  return shellBody({
    across: side === 1 ? [near, far] : [far, near],
    along: [-0.4, 0.4],
    columns: faces(40, detail),
    edge: (along) =>
      side === 1 ? [serration(along), 0] : [0, serration(along)],
    lump: 0.5,
    paint: (along, across, depth, color) => {
      const seam = side === 1 ? across : 1 - across;
      if (Math.abs(depth) < 0.75 && seam > 0.05) {
        spongy(color, across * 2, along, 37);
        return;
      }
      compact(color, along, across + side, 41);
      color.multiplyScalar(0.8 + 0.2 * Math.min(1, seam * 14));
    },
    radius: 1.2,
    rows: faces(260, detail),
    seed: 41 + side,
    thick: 0.075,
  });
}

/** The two bones of the skull's vault that meet at a suture, the seam running up the middle towards +z. */
export function vaultForms(detail: number): readonly Form[] {
  return [vaultBone(1, detail), vaultBone(-1, detail)];
}

/**
 * The band of fibrous tissue that fills a suture and binds its two bones:
 * a thin ribbon that follows every tooth of the seam.
 */
export function seamForms(detail: number): readonly Form[] {
  const fibre = new Color(SKELETON_COLORS.ligament);
  return [
    shellBody({
      across: [QUARTER - SEAM * 1.6, QUARTER + SEAM * 1.6],
      along: [-0.395, 0.395],
      columns: 6,
      edge: (along) => [serration(along), serration(along)],
      lump: 0,
      paint: (along, across, _side, color) => {
        color
          .copy(fibre)
          .multiplyScalar(0.7 + 0.3 * fractalAt(along, across, 90, 2, 43, 2));
      },
      radius: 1.2,
      rows: faces(260, detail),
      seed: 43,
      thick: 0.05,
    }),
  ];
}

/** How far the back of a vertebra's body is hollowed where the spinal cord passes, at a place round it. */
function hollow(around: number) {
  return -0.2 * Math.exp(-(((around - 0.5) / 0.1) ** 2));
}

/**
 * One vertebra with its body's middle at the origin, its front towards +z:
 * the waisted body with a rim round each end plate, the arch behind it that
 * roofs the spinal canal, the spinous process and the two transverse ones.
 */
export function vertebraForms(detail: number): readonly Form[] {
  const body = loftBody({
    along: faces(56, detail),
    around: faces(64, detail),
    belly: 0,
    lump: 0.04,
    paint: (along, around, color) => {
      compact(color, along, around, 47);
    },
    relief: (_along, around) => hollow(around),
    seed: 47,
    square: 2.2,
    stations: Arr.map(
      [
        [-0.115, 0],
        [-0.112, 0.9],
        [-0.085, 1],
        [0, 0.86],
        [0.085, 1],
        [0.112, 0.9],
        [0.115, 0],
      ] as const,
      ([y, girth]): Station => ({
        centre: [0, y, 0],
        tall: 0.16 * girth,
        wide: 0.21 * girth,
      })
    ),
    up: [0, 0, 1],
  });
  const process = (
    points: readonly (readonly [number, number, number, number, number])[],
    seed: number
  ) => bone(sections(points), seed, detail * 0.5);
  return [
    body,
    bone(
      duct([
        [-0.12, 0.03, -0.1, 0.04],
        [-0.15, 0.03, -0.24, 0.036],
        [-0.09, 0.02, -0.36, 0.034],
        [0, 0.01, -0.4, 0.036],
        [0.09, 0.02, -0.36, 0.034],
        [0.15, 0.03, -0.24, 0.036],
        [0.12, 0.03, -0.1, 0.04],
      ]),
      53,
      detail * 0.5
    ),
    process(
      [
        [0, 0.01, -0.37, 0.05, 0.03],
        [0, -0.01, -0.5, 0.062, 0.02],
        [0, -0.04, -0.62, 0.05, 0.022],
        [0, -0.05, -0.66, 0, 0],
      ],
      59
    ),
    ...Arr.map([1, -1] as const, (side) =>
      process(
        [
          [side * 0.13, 0.03, -0.25, 0.034, 0.034],
          [side * 0.25, 0.03, -0.28, 0.03, 0.024],
          [side * 0.37, 0.035, -0.31, 0.026, 0.02],
          [side * 0.4, 0.035, -0.315, 0, 0],
        ],
        61 + side
      )
    ),
  ];
}

/**
 * The disc between two vertebrae, its middle at the origin: a short thick
 * pad the shape of the bodies it joins, wrapped in the crossed rings of
 * fibres that let it give a little and no more.
 */
export function discForms(detail: number): readonly Form[] {
  const pale = new Color(SKELETON_COLORS.cartilageHyaline);
  const fibre = new Color(SKELETON_COLORS.ligament);
  return [
    loftBody({
      along: faces(24, detail),
      around: faces(64, detail),
      belly: 0,
      lump: 0.02,
      paint: (along, around, color) => {
        const ring = Math.sin((around * 26 + along * 3) * TURN);
        const cross = Math.sin((around * 26 - along * 3) * TURN);
        color.copy(fibre).lerp(pale, 0.55 + 0.2 * ring + 0.2 * cross);
      },
      relief: (_along, around) => hollow(around),
      seed: 67,
      square: 2.2,
      stations: Arr.map(
        [
          [-0.085, 0],
          [-0.08, 0.96],
          [0, 1.04],
          [0.08, 0.96],
          [0.085, 0],
        ] as const,
        ([y, girth]): Station => ({
          centre: [0, y, 0],
          tall: 0.16 * girth,
          wide: 0.21 * girth,
        })
      ),
      up: [0, 0, 1],
    }),
  ];
}
