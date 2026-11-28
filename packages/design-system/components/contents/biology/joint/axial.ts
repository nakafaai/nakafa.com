import {
  bone,
  compact,
  sections,
  spongy,
} from "@repo/design-system/components/contents/biology/joint/skeleton";
import { fractalAt } from "@repo/design-system/components/three/field/noise";
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

/** A quarter turn and a full turn, in radians. */
const QUARTER = Math.PI / 2;
const TURN = 2 * Math.PI;

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
const PLATE = 0.62;

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
    along: [-0.33, 0.33],
    columns: faces(48, detail),
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
      along: [-0.326, 0.326],
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
  const spur = (
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
    spur(
      [
        [0, 0.01, -0.37, 0.05, 0.03],
        [0, -0.01, -0.5, 0.062, 0.02],
        [0, -0.04, -0.62, 0.05, 0.022],
        [0, -0.05, -0.66, 0, 0],
      ],
      59
    ),
    ...Arr.map([1, -1] as const, (side) =>
      spur(
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
