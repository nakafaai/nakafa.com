import type { Coat, Species } from "@/lib/island/models/coat";
import { eyesOf } from "@/lib/island/models/features";
import { type Face, mirrored, type Vec } from "@/lib/island/models/parts";
import { ball, rod, slab, tube } from "@/lib/island/models/solids";

/** A head at `at` of radius `r` with its eyes, a beak `long` toward `tip`, and a tuft when the species has a crest. */
function headOf(
  at: Vec,
  r: number,
  beak: Vec,
  coat: Coat,
  crest: boolean
): readonly Face[] {
  const [x, y, z] = at;
  return [
    ...ball(at, [r, r, r * 1.05], coat.body, 2, 6),
    ...rod(
      [x, y - r * 0.15, z + r * 0.85],
      beak,
      [r * 0.35, 0],
      coat.accent,
      4
    ),
    ...eyesOf(
      {
        eye: [r * 0.78, y + r * 0.2, z + r * 0.35],
        jaw: at,
        size: r * 1.4,
        top: at,
        wide: r,
      },
      coat
    ),
    ...(crest
      ? slab(
          [
            [0, y + r * 0.8, z - r * 0.3],
            [0, y + r * 1.7, z - r * 0.7],
            [0, y + r * 0.9, z + r * 0.4],
          ],
          r * 0.25,
          coat.mark
        )
      : []),
  ];
}

/** Both folded wings: a long flat hull pressed to each side of the body, its tip reaching back past the tail's root. */
function wingOf(at: Vec, long: number, high: number, color: Face["color"]) {
  const [x, y, z] = at;
  const wing = tube(
    [
      { at: [x, y, z + long * 0.1], high: high * 0.5, wide: long * 0.05 },
      {
        at: [x + long * 0.02, y - high * 0.15, z - long * 0.35],
        high: high * 0.55,
        wide: long * 0.07,
      },
      { at: [x - long * 0.04, y - high * 0.3, z - long], high: 0, wide: 0 },
    ],
    color,
    6
  );
  return [...wing, ...mirrored(wing)];
}

/** Two thin legs from the body down to the ground at `top`, `apart` from the middle. */
function legsOf(
  top: number,
  apart: number,
  z: number,
  thick: number,
  coat: Coat
) {
  const leg = [
    ...rod([apart, top, z], [apart, 0, z], [thick, thick * 0.8], coat.leg, 4),
    ...rod(
      [apart, 0.01, z],
      [apart, 0.01, z + thick * 6],
      [thick * 0.9, 0],
      coat.leg,
      4
    ),
  ];
  return [...leg, ...mirrored(leg)];
}

/** A sparrow, a pigeon, a kingfisher (ADR 0047, D21): a round bird on two thin legs, one long, facing +z. */
export function songbird(species: Species, coat: Coat): readonly Face[] {
  return [
    ...ball([0, 0.34, 0], [0.16, 0.15, 0.28], coat.hide, 3, 6),
    ...headOf(
      [0, 0.5, 0.22],
      0.12,
      [0, 0.47, 0.44],
      coat,
      species.traits.crest
    ),
    ...wingOf([0.13, 0.38, 0.1], 0.42, 0.18, coat.mark),
    ...slab(
      [
        [0, 0.4, -0.2],
        [0.09, 0.36, -0.5],
        [-0.09, 0.36, -0.5],
      ],
      0.03,
      coat.mark
    ),
    ...legsOf(0.22, 0.05, 0.02, 0.012, coat),
  ];
}

/** How much longer than a duck's a waterbird's neck and bill are. */
const REACH: Partial<Record<Species["key"], readonly [number, number]>> = {
  goose: [1.4, 1],
  pelican: [1.2, 2.6],
  swan: [2, 1],
};

/** A duck, a goose, a swan (ADR 0047, D21): a boat-shaped body afloat on the origin, a neck, a head and a flat bill, one long. */
export function waterbird(species: Species, coat: Coat): readonly Face[] {
  const [neck, bill] = REACH[species.key] ?? [1, 1];
  const throat: Vec = [0, 0.18 + 0.24 * neck, 0.26 + 0.04 * neck];
  const head: Vec = [throat[0], throat[1] + 0.04, throat[2] + 0.06];
  return [
    ...tube(
      [
        { at: [0, 0.2, -0.5], high: 0, wide: 0 },
        { at: [0, 0.16, -0.4], high: 0.09, wide: 0.12 },
        { at: [0, 0.14, -0.15], high: 0.14, wide: 0.17 },
        { at: [0, 0.14, 0.15], high: 0.14, wide: 0.16 },
        { at: [0, 0.16, 0.32], high: 0.09, wide: 0.1 },
      ],
      coat.hide,
      6
    ),
    ...rod([0, 0.22, 0.27], throat, [0.055, 0.045], coat.body, 6),
    ...headOf(
      head,
      0.075,
      [0, head[1] - 0.02, head[2] + 0.07 + 0.12 * bill],
      coat,
      species.traits.crest
    ),
    ...wingOf([0.14, 0.2, 0.15], 0.5, 0.14, coat.mark),
  ];
}

/** A heron, a flamingo, a stork (ADR 0047, D21): tall on long legs, a long neck and a long bill, one high. */
export function wader(species: Species, coat: Coat): readonly Face[] {
  return [
    ...ball([0, 0.6, 0], [0.11, 0.11, 0.2], coat.hide, 3, 6),
    ...tube(
      [
        { at: [0, 0.64, 0.14], high: 0.04, wide: 0.04 },
        { at: [0, 0.78, 0.1], high: 0.03, wide: 0.03 },
        { at: [0, 0.9, 0.16], high: 0.03, wide: 0.03 },
      ],
      coat.body,
      4
    ),
    ...headOf(
      [0, 0.93, 0.18],
      0.05,
      [0, 0.88, 0.4],
      coat,
      species.traits.crest
    ),
    ...wingOf([0.09, 0.62, 0.1], 0.34, 0.14, coat.mark),
    ...legsOf(0.55, 0.035, 0, 0.012, coat),
  ];
}

/** An owl, an eagle, a parrot (ADR 0047, D21): perched upright, with a hooked beak and a tail hanging behind, one high; a peacock's long tail is its train. */
export function perch(species: Species, coat: Coat): readonly Face[] {
  const train = species.traits.tail === "long" && species.traits.crest;
  const long = species.traits.tail === "long";
  return [
    ...tube(
      [
        { at: [0, 0.1, -0.04], high: 0, wide: 0 },
        { at: [0, 0.18, -0.02], high: 0.15, wide: 0.17 },
        { at: [0, 0.42, 0.02], high: 0.15, wide: 0.18 },
        { at: [0, 0.62, 0.03], high: 0.1, wide: 0.13 },
      ],
      (spot) => (spot.up > 0.4 ? coat.belly : coat.body),
      6
    ),
    ...headOf(
      [0, 0.76, 0.04],
      0.14,
      [0, 0.64, 0.24],
      coat,
      species.traits.crest
    ),
    ...wingOf([0.16, 0.5, 0.02], 0.5, 0.3, coat.mark),
    ...slab(
      train
        ? [
            [0, 0.2, -0.12],
            [0.35, 0.02, -1.3],
            [-0.35, 0.02, -1.3],
          ]
        : [
            [0, 0.26, -0.12],
            [0.06, long ? 0.01 : 0.04, long ? -0.62 : -0.3],
            [-0.06, long ? 0.01 : 0.04, long ? -0.62 : -0.3],
          ],
      0.03,
      train ? coat.accent : coat.mark
    ),
    ...legsOf(0.12, 0.06, 0.04, 0.02, coat),
  ];
}
