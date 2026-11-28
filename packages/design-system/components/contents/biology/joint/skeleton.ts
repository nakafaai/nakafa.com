import {
  cellsAt,
  fractalAt,
  ridgedAt,
} from "@repo/design-system/components/three/field/noise";
import { faces } from "@repo/design-system/components/three/organism/budget";
import type { Form } from "@repo/design-system/components/three/organism/form";
import type { Station } from "@repo/design-system/components/three/organism/loft";
import { loftBody } from "@repo/design-system/components/three/organism/loft";
import { shellBody } from "@repo/design-system/components/three/organism/shell";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { Array as Arr } from "effect";
import { Color } from "three";

const IVORY = new Color(SKELETON_COLORS.bone);
const SOFT = new Color(SKELETON_COLORS.boneSoft);
const SPONGY = new Color(SKELETON_COLORS.spongyPorous);
const MARROW = new Color(SKELETON_COLORS.marrow);

/**
 * The colour of living compact bone at a place: ivory, mottled where it is
 * thinner, and pitted with the small holes its vessels enter by.
 */
export function compact(color: Color, x: number, y: number, seed: number) {
  const mottle = fractalAt(x, y, 7, 4, seed, 4);
  const streak = fractalAt(x, y, 3, 48, seed + 2, 3);
  const pit = cellsAt(x, y, 70, 36, seed + 1).nearest < 0.16 ? 0.8 : 1;
  color
    .copy(SOFT)
    .lerp(IVORY, Math.min(1, 0.1 + 0.9 * mottle))
    .multiplyScalar(pit * (0.82 + 0.26 * streak));
}

/**
 * The colour of spongy bone where a bone is cut: a lattice of pale struts
 * round pores full of red marrow.
 */
export function spongy(color: Color, x: number, y: number, seed: number) {
  const cell = cellsAt(x, y, 90, 40, seed);
  color.copy(MARROW).lerp(SPONGY, cell.second - cell.nearest < 0.22 ? 1 : 0.25);
}

/**
 * One bone lofted over its sections, ivory all over and showing its marrow
 * where `cut` says the bone was sawn through, as a share of its length from
 * each end.
 */
export function bone(
  stations: readonly Station[],
  seed: number,
  detail: number,
  cut: readonly [number, number] = [0, 0]
): Form {
  return loftBody({
    along: faces(120, detail),
    around: faces(40, detail),
    belly: 0,
    lump: 0.09,
    paint: (along, around, color) => {
      if (along < cut[0] || along > 1 - cut[1]) {
        spongy(color, around, along * 6, seed);
        return;
      }
      compact(color, along, around, seed);
    },
    relief: (along, around) =>
      0.05 * (ridgedAt(along, around, 3, 5, seed + 3, 2) - 0.5),
    seed,
    square: 2.3,
    stations,
    up: [0, 1, 0],
  });
}

/** The sections of a bone in the plane of the joint: where its middle runs, its half-height and its half-breadth. */
export function sections(
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
        [-0.52, 0, 0, 0, 0],
        [-0.51, 0, 0, 0.05, 0.05],
        [-0.42, 0, 0, 0.054, 0.054],
        [-0.34, 0, 0, 0.05, 0.056],
        [-0.26, 0, 0, 0.048, 0.072],
        [-0.17, 0, 0, 0.044, 0.105],
        [-0.09, 0, 0, 0.05, 0.145],
        [-0.04, 0, 0, 0.074, 0.118],
        [0, 0, 0, 0.084, 0.1],
        [0.04, 0, 0, 0.074, 0.1],
        [0.07, 0, 0, 0.046, 0.09],
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
        [0.34, -0.005, -0.04, 0.032, 0.032],
        [0.43, 0, -0.04, 0.03, 0.03],
        [0.51, 0, -0.04, 0.03, 0.032],
        [0.52, 0, -0.04, 0, 0],
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
        [0.36, 0, 0.075, 0.027, 0.028],
        [0.44, 0, 0.07, 0.028, 0.03],
        [0.51, 0, 0.065, 0.03, 0.032],
        [0.52, 0, 0.065, 0, 0],
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
        [-0.42, -0.04, -0.01, 0.14, 0.03],
        [-0.47, -0.06, -0.015, 0.19, 0.022],
        [-0.52, -0.08, -0.02, 0.2, 0.018],
        [-0.55, -0.09, -0.02, 0, 0],
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
        [0.32, 0, 0, 0.056, 0.056],
        [0.42, 0, 0, 0.052, 0.052],
        [0.51, 0, 0, 0.05, 0.05],
        [0.52, 0, 0, 0, 0],
      ]),
      31,
      detail,
      [0, 0.03]
    ),
  ];
}

/** Where the muscle's tendon grips the humerus at the shoulder, in the humerus's own frame. */
export const SHOULDER_INSERTION = [0.15, 0.096, 0] as const;
