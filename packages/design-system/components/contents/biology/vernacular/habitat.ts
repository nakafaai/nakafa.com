import {
  chanceAt,
  fractalAt,
  ridgedAt,
} from "@repo/design-system/components/three/field/noise";
import { faces } from "@repo/design-system/components/three/organism/budget";
import type { Form } from "@repo/design-system/components/three/organism/form";
import { loftBody } from "@repo/design-system/components/three/organism/loft";
import { moundBody } from "@repo/design-system/components/three/organism/mound";
import { scatter } from "@repo/design-system/components/three/organism/scatter";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Color } from "three";

const SAND = new Color(CLASSIFICATION_COLORS.seaSand);
const ROCK = new Color(CLASSIFICATION_COLORS.seaRock);
const BLADE = new Color(CLASSIFICATION_COLORS.seagrass);
const BLADE_TIP = new Color(CLASSIFICATION_COLORS.seagrassTip);
const LIGHT = new Color(CLASSIFICATION_COLORS.seaLight);
const WATER = new Color(CLASSIFICATION_COLORS.seaWater);
const DEEP = new Color(CLASSIFICATION_COLORS.seaDeep);

/** How far the seabed reaches from the middle of the scene, in scene units. */
const SEABED_REACH = 10;

/**
 * How high the seabed lies at a place: low banks and hollows of sand that
 * the tide has pushed up, never below the flat floor they cover.
 */
export function seabedAt(x: number, z: number) {
  const banks = fractalAt(x / 12 + 0.5, z / 12 + 0.5, 5, 5, 83, 3);
  const scour = ridgedAt(x / 12 + 0.5, z / 12 + 0.5, 9, 9, 89, 2);
  return 0.004 + 0.13 * banks + 0.03 * scour;
}

/** The seabed as one mound of rippled sand, darker in its hollows. */
export function seabedForms(detail: number): readonly Form[] {
  return [
    moundBody({
      height: (out, turn) =>
        seabedAt(
          out * SEABED_REACH * Math.cos(turn * 2 * Math.PI),
          out * SEABED_REACH * Math.sin(turn * 2 * Math.PI)
        ),
      paint: (out, turn, color) => {
        const high = seabedAt(
          out * SEABED_REACH * Math.cos(turn * 2 * Math.PI),
          out * SEABED_REACH * Math.sin(turn * 2 * Math.PI)
        );
        color
          .copy(SAND)
          .multiplyScalar(0.72 + 2 * high)
          .lerp(WATER, Math.min(1, out * 2.1) ** 1.4);
      },
      rim: () => SEABED_REACH,
      rings: faces(120, detail),
      spokes: faces(144, detail),
    }),
  ];
}

/**
 * One blade of seagrass, a unit tall along x: a flat ribbon with a rounded
 * tip that leans a little, dark at its base and bright where it grows.
 */
export function bladeForms(detail: number): readonly Form[] {
  return [
    loftBody({
      along: faces(8, detail),
      around: 4,
      belly: 0,
      lump: 0,
      paint: (along, _around, color) => {
        color.copy(BLADE).lerp(BLADE_TIP, along * along);
      },
      relief: () => 0,
      seed: 31,
      square: 2,
      stations: [
        { centre: [0, 0, 0], tall: 0.003, wide: 0.022 },
        { centre: [0.35, 0.02, 0], tall: 0.002, wide: 0.026 },
        { centre: [0.7, 0.08, 0], tall: 0.002, wide: 0.024 },
        { centre: [0.97, 0.17, 0], tall: 0.001, wide: 0.014 },
        { centre: [1, 0.18, 0], tall: 0, wide: 0 },
      ],
      up: [0, 1, 0],
    }),
  ];
}

/** One weathered lump of coral rock, a unit across, for the rubble on the sand. */
export function rockForms(detail: number): readonly Form[] {
  return [
    loftBody({
      along: faces(24, detail),
      around: faces(24, detail),
      belly: 0.5,
      lump: 0.32,
      paint: (along, around, color) => {
        color
          .copy(ROCK)
          .multiplyScalar(0.6 + 0.8 * fractalAt(along, around, 5, 5, 97, 3));
      },
      relief: () => 0,
      seed: 37,
      square: 2.6,
      stations: [
        { centre: [-0.5, 0, 0], tall: 0, wide: 0 },
        { centre: [-0.42, 0, 0], tall: 0.2, wide: 0.26 },
        { centre: [-0.1, 0.02, 0], tall: 0.34, wide: 0.42 },
        { centre: [0.25, 0, 0], tall: 0.28, wide: 0.36 },
        { centre: [0.45, 0, 0], tall: 0.14, wide: 0.2 },
        { centre: [0.5, 0, 0], tall: 0, wide: 0 },
      ],
      up: [0, 1, 0],
    }),
  ];
}

/**
 * One shaft of sunlight through the water, a unit long along x and widening
 * as it falls, bright at the surface and gone by the sand.
 */
export function shaftForms(detail: number): readonly Form[] {
  return [
    loftBody({
      along: faces(12, detail),
      around: faces(12, detail),
      belly: 0,
      lump: 0.15,
      paint: (along, _around, color) => {
        color.copy(LIGHT).multiplyScalar((1 - along) ** 1.5);
      },
      relief: () => 0,
      seed: 41,
      square: 2,
      stations: [
        { centre: [0, 0, 0], tall: 0.05, wide: 0.07 },
        { centre: [0.5, 0, 0], tall: 0.09, wide: 0.12 },
        { centre: [1, 0, 0], tall: 0.14, wide: 0.18 },
      ],
      up: [0, 1, 0],
    }),
  ];
}

/**
 * A meadow of seagrass: tufts of blades rooted in the sand in loose
 * patches, the pasture a dugong grazes, each blade its own height and lean.
 */
export function meadow(count: number) {
  return scatter(count, 43, (_index, chance) => {
    const patch = Math.floor(chance(1) * 9);
    const spread = 0.62 * Math.sqrt(chance(2));
    const bearing = chance(3) * 2 * Math.PI;
    const x = -2.8 + 5.6 * chanceAt(patch, 1, 47) + spread * Math.cos(bearing);
    const z = -2.4 + 3.6 * chanceAt(patch, 2, 47) + spread * Math.sin(bearing);
    const tall = 0.07 + 0.11 * chance(4);
    return {
      lean: [chance(5) * 2 * Math.PI, 0, Math.PI / 2 - 0.25 * chance(6)],
      place: [x, seabedAt(x, z) - 0.01, z],
      size: [tall, tall, 0.2 + 0.2 * chance(7)],
    };
  });
}

/** Rubble on the sand: lumps of old coral rock of every size, half buried. */
export function rubble(count: number) {
  return scatter(count, 53, (_index, chance) => {
    const x = -3.4 + 6.8 * chance(1);
    const z = -3 + 4.4 * chance(2);
    const size = 0.07 + 0.22 * chance(3) ** 2;
    return {
      lean: [0, chance(4) * 2 * Math.PI, 0.3 * (chance(5) - 0.5)],
      place: [x, seabedAt(x, z) + size * 0.08, z],
      size: [size, size * (0.6 + 0.4 * chance(6)), size],
    };
  });
}

/** Shafts of sunlight slanting down from the surface, each its own length and girth. */
export function shafts(count: number) {
  return scatter(count, 59, (_index, chance) => {
    const long = 1.5 + 0.9 * chance(3);
    return {
      lean: [0, 0, -Math.PI / 2 - 0.28 - 0.1 * chance(4)],
      place: [-3 + 6 * chance(1), 1.34, -2.6 + 3.2 * chance(2)],
      size: [long, 0.6 + 1.2 * chance(5), 0.6 + 1.2 * chance(6)],
    };
  });
}

/**
 * Marine snow: the places of the motes that drift in the water column,
 * three numbers each.
 */
export function motes(count: number) {
  return Float32Array.from({ length: count * 3 }, (_, at) => {
    const share = chanceAt(Math.floor(at / 3), at % 3, 61);
    const reach = at % 3 === 0 ? -3.5 + 7 * share : -3.5 + 5 * share;
    return at % 3 === 1 ? 0.1 + 1.15 * share : reach;
  });
}

/** The fringe of tentacles round a jellyfish bell of `radius`: each hangs from the margin, its own length. */
export function fringe(count: number, radius: number) {
  return scatter(count, 67, (index, chance) => {
    const turn = (index / count) * 2 * Math.PI;
    const long = 0.05 + 0.06 * chance(1);
    return {
      lean: [0, -turn, -Math.PI / 2 + 0.06 + 0.22 * chance(2)],
      place: [radius * Math.cos(turn), 0, radius * Math.sin(turn)],
      size: [long, 1, 1],
    };
  });
}

/** A shoal behind the leading mackerel: each fish its own place, size and heading. */
export function shoal(count: number) {
  return scatter(count, 71, (index, chance) => {
    const size = 0.5 + 0.3 * chance(1);
    return {
      lean: [0, 0.3 * (chance(2) - 0.5), 0.12 * (chance(3) - 0.5)],
      place: [
        -0.12 - 0.1 * index + 0.08 * chance(4),
        -0.15 + 0.27 * chance(5),
        -0.2 - 0.45 * chance(6),
      ],
      size: [size, size, size],
    };
  });
}

/**
 * The sea's surface seen from below: a wide sheet that heaves in a slow
 * swell, bright where the sun comes through.
 */
export function surfaceForms(detail: number): readonly Form[] {
  return [
    moundBody({
      height: (out, turn) =>
        1.28 +
        0.07 *
          fractalAt(
            0.5 + 0.5 * out * Math.cos(turn * 2 * Math.PI),
            0.5 + 0.5 * out * Math.sin(turn * 2 * Math.PI),
            14,
            14,
            101,
            2
          ),
      paint: (out, _turn, color) => {
        color.copy(LIGHT).lerp(WATER, Math.min(1, out * 1.3));
      },
      rim: () => SEABED_REACH,
      rings: faces(64, detail),
      spokes: faces(96, detail),
    }),
  ];
}

/**
 * The water column all round the scene: a tall dome that is bright and
 * green-blue near the surface and falls to deep blue towards the sand, so
 * the animals hang in open water.
 */
export function waterForms(detail: number): readonly Form[] {
  return [
    loftBody({
      along: faces(24, detail),
      around: faces(48, detail),
      belly: 0,
      lump: 0,
      paint: (along, _around, color) => {
        color.copy(DEEP).lerp(WATER, Math.min(1, along * 2.2));
        color.lerp(LIGHT, Math.max(0, along - 0.45) * 1.1);
      },
      relief: () => 0,
      seed: 73,
      square: 2,
      stations: [
        { centre: [-1, 0, 0], tall: SEABED_REACH, wide: SEABED_REACH },
        { centre: [0.3, 0, 0], tall: SEABED_REACH, wide: SEABED_REACH },
        { centre: [1.3, 0, 0], tall: SEABED_REACH, wide: SEABED_REACH },
        { centre: [1.31, 0, 0], tall: 0, wide: 0 },
      ],
      up: [0, 1, 0],
    }),
  ];
}
