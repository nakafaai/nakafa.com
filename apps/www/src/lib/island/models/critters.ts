import { Array as Arr } from "effect";
import type { Coat, Species } from "@/lib/island/models/coat";
import { eyesOf } from "@/lib/island/models/features";
import { type Face, mirrored, type Vec } from "@/lib/island/models/parts";
import { ball, rod, slab, tint, tube } from "@/lib/island/models/solids";

/** Six thin legs from a body's side at height `y`, splayed out to the ground. */
function sixLegs(y: number, wide: number, reach: number, coat: Coat) {
  const legs = Arr.flatMap([0.12, 0, -0.12], (z) => [
    ...rod(
      [wide, y, z],
      [wide + reach * 0.6, y + reach * 0.15, z * 1.3],
      [reach * 0.05, reach * 0.04],
      coat.dark,
      4
    ),
    ...rod(
      [wide + reach * 0.6, y + reach * 0.15, z * 1.3],
      [wide + reach, 0, z * 1.6],
      [reach * 0.04, 0],
      coat.dark,
      4
    ),
  ]);
  return [...legs, ...mirrored(legs)];
}

/** Two feelers from the head at `at`. */
function feelers(at: Vec, long: number, color: Face["color"]) {
  const [x, y, z] = at;
  const feeler = rod(
    [x + long * 0.05, y, z],
    [x + long * 0.35, y + long * 0.5, z + long * 0.75],
    [long * 0.03, 0],
    color,
    4
  );
  return [...feeler, ...mirrored(feeler)];
}

/**
 * A butterfly or a moth (ADR 0047, D21), one across its wings, resting on the
 * origin facing +z with its wings half raised: forewings in its color with a
 * mark at each tip, smaller hind wings, a thin body on six thin legs, and two
 * feelers.
 */
export function butterfly(_species: Species, coat: Coat): readonly Face[] {
  const wings = [
    ...slab(
      [
        [0.02, 0.12, 0.06],
        [0.48, 0.4, 0.16],
        [0.44, 0.34, -0.06],
        [0.02, 0.1, -0.02],
      ],
      0.01,
      coat.body
    ),
    ...slab(
      [
        [0.3, 0.32, 0.14],
        [0.47, 0.42, 0.16],
        [0.45, 0.38, 0.06],
      ],
      0.016,
      coat.mark
    ),
    ...slab(
      [
        [0.02, 0.1, -0.02],
        [0.3, 0.24, -0.06],
        [0.22, 0.18, -0.26],
        [0.02, 0.09, -0.12],
      ],
      0.01,
      coat.belly
    ),
  ];
  return [
    ...sixLegs(0.09, 0.015, 0.07, coat),
    ...wings,
    ...mirrored(wings),
    ...rod([0, 0.1, 0.12], [0, 0.08, -0.2], [0.025, 0.012], coat.accent, 4),
    ...ball([0, 0.11, 0.14], [0.03, 0.03, 0.03], coat.accent, 1, 6),
    ...feelers([0, 0.12, 0.16], 0.2, coat.accent),
  ];
}

/** A beetle or a ladybird (ADR 0047, D21), one long: a domed shell in its pattern, a small head, six legs, and a horn when it has one. */
export function beetle(species: Species, coat: Coat): readonly Face[] {
  return [
    ...ball(
      [0, 0.2, -0.05],
      [0.3, 0.17, 0.38],
      (spot) => {
        if (spot.up < -0.5) {
          return coat.dark;
        }
        const dotted =
          species.pattern === "spots" && (spot.segment + spot.side) % 3 === 0;
        return dotted ? coat.mark : coat.body;
      },
      3,
      8
    ),
    ...ball([0, 0.16, 0.36], [0.15, 0.1, 0.1], coat.dark, 1, 6),
    ...sixLegs(0.12, 0.2, 0.3, coat),
    ...(species.traits.horns === "none"
      ? []
      : rod([0, 0.2, 0.42], [0, 0.42, 0.55], [0.05, 0], coat.dark, 4)),
    ...eyesOf(
      {
        eye: [0.12, 0.18, 0.4],
        jaw: [0, 0, 0],
        size: 0.12,
        top: [0, 0, 0],
        wide: 0.13,
      },
      coat
    ),
  ];
}

/** Whether a flyer is a dragonfly or a damselfly, long and thin with four long wings. */
const DARTERS: readonly Species["key"][] = ["dragonfly", "damselfly"];

/**
 * A bee, a wasp or a dragonfly (ADR 0047, D21), one long: a banded body, a
 * head, clear wings above it, and short legs; a dragonfly's body is a long
 * thin rod under four long wings.
 */
export function bee(species: Species, coat: Coat): readonly Face[] {
  const glass = tint("glass", 3);
  if (Arr.contains(DARTERS, species.key)) {
    const wings = [
      ...slab(
        [
          [0.02, 0.1, 0.18],
          [0.5, 0.12, 0.2],
          [0.5, 0.12, 0.12],
          [0.02, 0.1, 0.12],
        ],
        0.008,
        glass
      ),
      ...slab(
        [
          [0.02, 0.1, 0.08],
          [0.46, 0.12, 0.04],
          [0.46, 0.12, -0.03],
          [0.02, 0.1, 0.03],
        ],
        0.008,
        glass
      ),
    ];
    return [
      ...tube(
        [
          { at: [0, 0.08, 0.2], high: 0.035, wide: 0.035 },
          { at: [0, 0.08, 0.05], high: 0.03, wide: 0.03 },
          { at: [0, 0.08, -0.5], high: 0.014, wide: 0.014 },
        ],
        (spot) =>
          spot.segment === 1 && spot.side % 2 === 0 ? coat.mark : coat.body,
        6
      ),
      ...ball([0, 0.08, 0.25], [0.05, 0.045, 0.045], coat.accent, 1, 6),
      ...wings,
      ...mirrored(wings),
    ];
  }
  const wing = slab(
    [
      [0.04, 0.3, 0.12],
      [0.36, 0.42, -0.02],
      [0.32, 0.38, -0.16],
      [0.04, 0.28, 0.02],
    ],
    0.01,
    glass
  );
  return [
    ...tube(
      [
        { at: [0, 0.2, 0.08], high: 0.12, wide: 0.12 },
        { at: [0, 0.2, -0.05], high: 0.17, wide: 0.17 },
        { at: [0, 0.19, -0.18], high: 0.17, wide: 0.17 },
        { at: [0, 0.18, -0.3], high: 0.13, wide: 0.13 },
        { at: [0, 0.17, -0.42], high: 0, wide: 0 },
      ],
      (spot) => (spot.segment % 2 === 1 ? coat.mark : coat.body),
      6
    ),
    ...ball([0, 0.23, 0.17], [0.1, 0.1, 0.09], coat.accent, 1, 6),
    ...ball([0, 0.22, 0.32], [0.08, 0.08, 0.07], coat.dark, 1, 6),
    ...wing,
    ...mirrored(wing),
    ...sixLegs(0.12, 0.08, 0.16, coat),
    ...feelers([0, 0.27, 0.37], 0.14, coat.dark),
  ];
}

/**
 * A crab or a lobster (ADR 0047, D21), one across: a wide shell on eight
 * legs, two claws raised before it, and stalked eyes; a lobster's shell runs
 * long into a banded tail.
 */
export function crab(species: Species, coat: Coat): readonly Face[] {
  const lobster = species.home === "sea";
  const legs = Arr.flatMap([0.1, 0.02, -0.06, -0.14], (z) => [
    ...rod([0.18, 0.12, z], [0.34, 0.16, z * 1.3], [0.025, 0.02], coat.body, 4),
    ...rod([0.34, 0.16, z * 1.3], [0.42, 0, z * 1.6], [0.02, 0], coat.body, 4),
  ]);
  const claw = [
    ...rod([0.16, 0.14, 0.16], [0.26, 0.24, 0.32], [0.035, 0.03], coat.body, 4),
    ...ball([0.27, 0.26, 0.38], [0.06, 0.05, 0.08], coat.accent, 1, 6),
    ...rod([0.06, 0.2, 0.18], [0.07, 0.27, 0.2], [0.012, 0.012], coat.dark, 4),
    ...ball([0.07, 0.28, 0.2], [0.02, 0.02, 0.02], coat.eye, 1, 6),
  ];
  return [
    ...ball(
      [0, 0.15, lobster ? 0.02 : 0],
      [lobster ? 0.13 : 0.24, 0.09, lobster ? 0.22 : 0.17],
      coat.hide,
      2,
      8
    ),
    ...(lobster
      ? tube(
          [
            { at: [0, 0.14, -0.18], high: 0.07, wide: 0.1 },
            { at: [0, 0.12, -0.32], high: 0.06, wide: 0.09 },
            { at: [0, 0.1, -0.46], high: 0.04, wide: 0.07 },
            { at: [0, 0.08, -0.54], high: 0.02, wide: 0.12 },
          ],
          (spot) => (spot.segment === 1 ? coat.mark : coat.body),
          6
        )
      : []),
    ...legs,
    ...mirrored(legs),
    ...claw,
    ...mirrored(claw),
  ];
}

/** A snail (ADR 0047, D21), one long: a soft foot along the ground, a coiled shell on its back, and two feelers. */
export function snail(_species: Species, coat: Coat): readonly Face[] {
  return [
    ...tube(
      [
        { at: [0, 0.05, -0.48], high: 0, wide: 0 },
        { at: [0, 0.05, -0.38], high: 0.04, wide: 0.08 },
        { at: [0, 0.06, 0.2], high: 0.06, wide: 0.1 },
        { at: [0, 0.12, 0.36], high: 0.08, wide: 0.08 },
        { at: [0, 0.16, 0.44], high: 0.06, wide: 0.06 },
      ],
      coat.belly,
      6
    ),
    ...ball([0, 0.3, -0.08], [0.15, 0.24, 0.26], coat.hide, 3, 8),
    ...ball([0.06, 0.34, -0.06], [0.12, 0.14, 0.15], coat.mark, 2, 6),
    ...feelers([0, 0.2, 0.44], 0.22, coat.belly),
  ];
}
