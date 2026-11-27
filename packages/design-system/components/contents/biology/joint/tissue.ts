import { fractalAt } from "@repo/design-system/components/three/field/noise";
import { faces } from "@repo/design-system/components/three/organism/budget";
import type { Form } from "@repo/design-system/components/three/organism/form";
import type { Station } from "@repo/design-system/components/three/organism/loft";
import { loftBody } from "@repo/design-system/components/three/organism/loft";
import type { Shell } from "@repo/design-system/components/three/organism/shell";
import { shellBody } from "@repo/design-system/components/three/organism/shell";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { Array as Arr } from "effect";
import { Color } from "three";

const PEARL = new Color(SKELETON_COLORS.cartilageHyaline);
const FIBRE = new Color(SKELETON_COLORS.capsuleFibre);
const BAND = new Color(SKELETON_COLORS.ligament);
const SYNOVIUM = new Color(SKELETON_COLORS.synovium);
const STRAW = new Color(SKELETON_COLORS.fluidStraw);
const TENDON = new Color(SKELETON_COLORS.tendon);
const RED = new Color(SKELETON_COLORS.muscleContract);
const DARK = new Color(SKELETON_COLORS.muscleDark);

/** Which synovial joint a part belongs to: the elbow's hinge or the shoulder's ball and socket. */
export type Synovial = "hinge" | "ballSocket";

/** A thin even sheet over part of a ball about the origin, in one tone that `paint` varies. */
function sheet(
  patch: Pick<Shell, "across" | "along" | "radius" | "thick">,
  paint: Shell["paint"],
  detail: number
): Form {
  return shellBody({
    ...patch,
    columns: faces(40, detail),
    edge: () => [0, 0],
    lump: 0.6,
    paint,
    rows: faces(48, detail),
    seed: 71,
  });
}

/** The pearly, faintly blue tone of hyaline cartilage, a little uneven. */
function pearl(along: number, across: number, color: Color) {
  color
    .copy(PEARL)
    .multiplyScalar(0.92 + 0.08 * fractalAt(along, across, 6, 6, 73, 2));
}

/**
 * The cartilage on the bone that stays still: the cap over the elbow's
 * trochlea, or the lining of the shoulder's socket.
 */
export function fixedCartilage(kind: Synovial) {
  return (detail: number): readonly Form[] =>
    kind === "hinge"
      ? [
          loftBody({
            along: faces(40, detail),
            around: faces(48, detail),
            belly: 0,
            lump: 0.02,
            paint: pearl,
            relief: () => 0,
            seed: 79,
            square: 2.3,
            stations: Arr.map(
              [
                [-0.058, 0, 0],
                [-0.046, 0.076, 0.134],
                [0, 0.094, 0.134],
                [0.04, 0.084, 0.134],
                [0.074, 0.056, 0.12],
                [0.094, 0, 0],
              ] as const,
              ([x, tall, wide]): Station => ({ centre: [x, 0, 0], tall, wide })
            ),
            up: [0, 1, 0],
          }),
        ]
      : [
          sheet(
            {
              across: [Math.PI - 0.8, Math.PI + 0.8],
              along: [-0.88, 0.88],
              radius: 0.131,
              thick: 0.008,
            },
            (along, across, _side, color) => pearl(along, across, color),
            detail
          ),
        ];
}

/** The cartilage over the ball of the humerus at the shoulder, which turns with the bone. */
export function headCartilage(detail: number): readonly Form[] {
  return [
    sheet(
      {
        across: [Math.PI - 1.3, Math.PI + 1.3],
        along: [-1.2, 1.2],
        radius: 0.116,
        thick: 0.008,
      },
      (along, across, _side, color) => pearl(along, across, color),
      detail
    ),
  ];
}

/** The part of a ball round the joint its capsule covers once the front is cut away, and the capsule's radius. */
const CAPSULE: Record<Synovial, Pick<Shell, "across" | "along">> = {
  ballSocket: { across: [2.75, 4.62], along: [-1.13, 0.6] },
  hinge: { across: [3.75, 5.67], along: [-1.05, 1.05] },
};
const WALL = 0.2;

/**
 * A joint's capsule with its front cut away: tough fibrous tissue outside,
 * banded where it thickens into ligaments, and the soft red synovial
 * membrane that makes the fluid lining it inside.
 */
export function capsuleForms(kind: Synovial) {
  return (detail: number): readonly Form[] => [
    sheet(
      { ...CAPSULE[kind], radius: WALL, thick: 0.014 },
      (along, across, side, color) => {
        if (side < 0) {
          color
            .copy(SYNOVIUM)
            .multiplyScalar(0.8 + 0.3 * fractalAt(along, across, 14, 14, 83, 3));
          return;
        }
        const band = 0.5 + 0.5 * Math.sin(across * 16 + along * 5);
        color
          .copy(FIBRE)
          .lerp(BAND, band * band)
          .multiplyScalar(0.85 + 0.15 * fractalAt(along, across, 3, 60, 89, 2));
      },
      detail
    ),
  ];
}

/** The film of synovial fluid inside a joint's capsule: a clear, straw-coloured, slippery layer. */
export function fluidForms(kind: Synovial) {
  return (detail: number): readonly Form[] => [
    sheet(
      {
        across: [CAPSULE[kind].across[0] + 0.04, CAPSULE[kind].across[1] - 0.04],
        along: [CAPSULE[kind].along[0] + 0.04, CAPSULE[kind].along[1] - 0.04],
        radius: WALL - 0.016,
        thick: 0.012,
      },
      (_along, _across, _side, color) => {
        color.copy(STRAW);
      },
      detail
    ),
  ];
}

/** The tone of a cord of parallel collagen fibres: a tendon or a ligament. */
function corded(tone: Color, seed: number) {
  return (along: number, around: number, color: Color) => {
    color
      .copy(tone)
      .multiplyScalar(0.78 + 0.3 * fractalAt(along, around, 2, 44, seed, 3));
  };
}

/**
 * The elbow's collateral ligament in the forearm's own frame: a flat strap
 * from the humerus's epicondyle, on the joint's axis, over the head of the
 * radius to its neck, so it stays fixed at both ends as the elbow bends.
 */
export function collateralForms(detail: number): readonly Form[] {
  return [
    loftBody({
      along: faces(40, detail),
      around: faces(16, detail),
      belly: 0,
      lump: 0.04,
      paint: corded(BAND, 97),
      relief: () => 0,
      seed: 97,
      square: 3,
      stations: Arr.map(
        [
          [-0.02, 0, 0.128, 0],
          [-0.005, 0, 0.138, 0.03],
          [0.07, 0, 0.145, 0.026],
          [0.13, 0, 0.143, 0.024],
          [0.2, 0.002, 0.122, 0.02],
          [0.225, 0.002, 0.112, 0],
        ] as const,
        ([x, y, z, tall]): Station => ({
          centre: [x, y, z],
          tall,
          wide: tall === 0 ? 0 : 0.008,
        })
      ),
      up: [0, 1, 0],
    }),
  ];
}

/**
 * A tendon one unit long and one unit thick along x, ready to be stretched
 * between a muscle and the bone it pulls: a cord of pale fibres.
 */
export function tendonForms(detail: number): readonly Form[] {
  return [
    loftBody({
      along: faces(24, detail),
      around: faces(16, detail),
      belly: 0,
      lump: 0,
      paint: corded(TENDON, 101),
      relief: () => 0,
      seed: 101,
      square: 2.6,
      stations: Arr.map(
        [
          [-0.04, 0],
          [0, 1],
          [0.5, 0.86],
          [0.94, 1],
          [1.02, 0],
        ] as const,
        ([x, girth]): Station => ({
          centre: [x, 0, 0],
          tall: girth,
          wide: 0.7 * girth,
        })
      ),
      up: [0, 1, 0],
    }),
  ];
}

/**
 * A skeletal muscle one unit long and one unit thick along x, ready to be
 * stretched from its origin to its tendon: a spindle of red fascicles that
 * narrows into pale tendon at each end.
 */
export function bellyForms(detail: number): readonly Form[] {
  return [
    loftBody({
      along: faces(64, detail),
      around: faces(40, detail),
      belly: 0,
      lump: 0.03,
      paint: (along, around, color) => {
        const fascicle = fractalAt(along, around, 2, 30, 103, 3);
        const end = Math.min(1, Math.min(along, 1 - along) / 0.14);
        color
          .copy(DARK)
          .lerp(RED, 0.25 + 0.75 * fascicle)
          .lerp(TENDON, 1 - end * end * (3 - 2 * end));
      },
      relief: (_along, around) => 0.05 * Math.sin(around * 2 * Math.PI * 9),
      seed: 103,
      square: 2,
      stations: Arr.makeBy(15, (step): Station => {
        const along = step / 14;
        const girth =
          step === 0 || step === 14
            ? 0
            : 0.16 + 0.84 * Math.sin(Math.PI * along) ** 0.8;
        return { centre: [along, 0, 0], tall: girth, wide: girth };
      }),
      up: [0, 1, 0],
    }),
  ];
}
