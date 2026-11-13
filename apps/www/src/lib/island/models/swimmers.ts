import { Array as Arr } from "effect";
import type { Coat, Species } from "@/lib/island/models/coat";
import { eyesOf } from "@/lib/island/models/features";
import { type Face, mirrored, type Vec } from "@/lib/island/models/parts";
import { ball, rod, slab, tube } from "@/lib/island/models/solids";

/** How a fish's body departs from the common torpedo: taller, rounder, or with long fins. */
const BUILDS: Partial<Record<Species["key"], readonly [number, number]>> = {
  angelfish: [2.4, 2.2],
  betta: [1, 2.6],
  "blue-tang": [1.7, 1],
  pufferfish: [1.6, 1],
  arowana: [0.7, 1],
  tuna: [1.05, 0.8],
};

/**
 * A fish (ADR 0047, D21), one long from its snout to its tail fin, centered
 * on the origin and facing +z: a narrow body in its coat and pattern, a
 * forked tail fin, a back fin (spiny when it has a crest), side fins and eyes.
 */
export function fish(species: Species, coat: Coat): readonly Face[] {
  const [tall, fins] = BUILDS[species.key] ?? [1, 1];
  const high = 0.13 * tall;
  const fin = (corners: Arr.NonEmptyReadonlyArray<Vec>) =>
    slab(corners, 0.012, coat.accent);
  const side = fin([
    [0.06, -high * 0.3, 0.12],
    [0.16, -high * 0.6, 0.02],
    [0.07, -high * 0.5, 0.05],
  ]);
  return [
    ...tube(
      [
        { at: [0, 0, 0.42], high: 0, wide: 0 },
        { at: [0, 0, 0.36], high: high * 0.55, wide: 0.04 },
        { at: [0, 0, 0.22], high: high * 0.95, wide: 0.065 },
        { at: [0, 0, 0.02], high, wide: 0.07 },
        { at: [0, 0, -0.18], high: high * 0.7, wide: 0.05 },
        { at: [0, 0, -0.3], high: high * 0.28, wide: 0.025 },
      ],
      coat.hide,
      6
    ),
    ...fin([
      [0, high * 0.2, -0.29],
      [0, high * 0.6 + 0.12 * fins, -0.5],
      [0, 0, -0.42],
      [0, -high * 0.6 - 0.12 * fins, -0.5],
      [0, -high * 0.2, -0.29],
    ]),
    ...fin([
      [0, high * 0.9, 0.16],
      [0, high + 0.06 * fins * (species.traits.crest ? 1.6 : 1), 0.02],
      [0, high * 0.75, -0.16],
    ]),
    ...side,
    ...mirrored(side),
    ...eyesOf(
      {
        eye: [0.045, high * 0.25, 0.3],
        jaw: [0, 0, 0],
        size: 0.12,
        top: [0, 0, 0],
        wide: 0.05,
      },
      coat
    ),
  ];
}

/** An eel, a moray, a barracuda (ADR 0047, D21): long and narrow along a gentle wave, one long, centered on the origin. */
export function eel(_species: Species, coat: Coat): readonly Face[] {
  const rings = Arr.makeBy(9, (index) => {
    const along = index / 8;
    const wave = Math.sin(along * Math.PI * 2) * 0.03;
    const thick =
      index === 0
        ? 0
        : 0.035 * Math.sin(Math.min(1, (1 - along) * 1.4 + 0.2) * 1.4);
    return {
      at: [wave, 0, 0.5 - along] as Vec,
      high: index === 8 ? 0 : thick * 1.2,
      wide: index === 8 ? 0 : thick,
    };
  });
  const [first, ...rest] = Arr.reverse(rings);
  return [
    ...tube([first, ...rest], coat.hide, 6),
    ...slab(
      [
        [0, 0.04, 0.2],
        [0, 0.06, -0.3],
        [0, 0.03, -0.45],
      ],
      0.01,
      coat.accent
    ),
    ...eyesOf(
      {
        eye: [0.022, 0.012, 0.43],
        jaw: [0, 0, 0],
        size: 0.06,
        top: [0, 0, 0],
        wide: 0.03,
      },
      coat
    ),
  ];
}

/** A ray or a flatfish (ADR 0047, D21): wide and flat with a thin tail, one across, centered on the origin. */
export function ray(_species: Species, coat: Coat): readonly Face[] {
  return [
    ...tube(
      [
        { at: [0, 0, 0.32], high: 0.02, wide: 0.06 },
        { at: [0, 0, 0.15], high: 0.05, wide: 0.42 },
        { at: [0, 0, 0], high: 0.06, wide: 0.5 },
        { at: [0, 0, -0.15], high: 0.04, wide: 0.24 },
        { at: [0, 0, -0.24], high: 0, wide: 0 },
      ],
      coat.hide,
      6
    ),
    ...rod([0, 0, -0.22], [0, 0.01, -0.75], [0.015, 0], coat.accent, 4),
    ...eyesOf(
      {
        eye: [0.07, 0.04, 0.2],
        jaw: [0, 0, 0],
        size: 0.1,
        top: [0, 0, 0],
        wide: 0.07,
      },
      coat
    ),
  ];
}

/**
 * A sea turtle or a tortoise (ADR 0047, D21), one long over its shell,
 * standing on the origin: a domed shell, a pale underside, a head, and four
 * flippers in the sea or four stout legs on land.
 */
export function turtle(species: Species, coat: Coat): readonly Face[] {
  const sea = species.home === "sea";
  const limb = (z: number, back: number) =>
    sea
      ? slab(
          [
            [0.28, 0.1, z],
            [0.62, 0.08, z - 0.12 * back],
            [0.3, 0.09, z - 0.18 * back],
          ],
          0.03,
          coat.accent
        )
      : rod([0.3, 0.12, z], [0.3, 0, z], [0.07, 0.06], coat.accent, 4);
  const limbs = [...limb(0.22, 1), ...limb(-0.25, 0.5)];
  return [
    ...ball([0, 0.13, 0], [0.33, 0.06, 0.4], coat.belly, 2, 8),
    ...ball([0, 0.17, 0], [0.36, 0.17, 0.42], coat.hide, 3, 8),
    ...limbs,
    ...mirrored(limbs),
    ...ball([0, 0.15, 0.47], [0.08, 0.07, 0.1], coat.accent, 2, 6),
    ...eyesOf(
      {
        eye: [0.065, 0.18, 0.5],
        jaw: [0, 0, 0],
        size: 0.1,
        top: [0, 0, 0],
        wide: 0.07,
      },
      coat
    ),
  ];
}
