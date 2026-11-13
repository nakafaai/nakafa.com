import { Array as Arr } from "effect";
import type { Coat, Species } from "@/lib/island/models/coat";
import { eyesOf } from "@/lib/island/models/features";
import { type Face, mirrored, type Vec } from "@/lib/island/models/parts";
import { ball, rod, slab, tube } from "@/lib/island/models/solids";

/** How much longer than a gecko's a lizard's snout is: a crocodile's and a monitor's run long. */
const SNOUTS: Partial<Record<Species["key"], number>> = {
  crocodile: 2.6,
  komodo: 1.5,
  monitor: 1.5,
};

/** A splayed leg from the hip at `at` out and down to the ground. */
function splayed(at: Vec, thick: number, coat: Coat) {
  const [x, y, z] = at;
  return [
    ...rod(
      at,
      [x + thick * 2.6, y + thick * 0.4, z + thick * 0.6],
      [thick, thick * 0.8],
      coat.leg,
      4
    ),
    ...rod(
      [x + thick * 2.6, y + thick * 0.4, z + thick * 0.6],
      [x + thick * 3.2, thick * 0.5, z + thick * 1.4],
      [thick * 0.8, thick * 0.6],
      coat.leg,
      4
    ),
  ];
}

/**
 * A lizard, a monitor or a crocodile (ADR 0047, D21), one long from snout to
 * tail tip, standing on the origin and facing +z: a low body, splayed legs, a
 * head with its snout, and a long tail along the ground; a crest of spines
 * down the back when it has one.
 */
export function lizard(species: Species, coat: Coat): readonly Face[] {
  const snout = SNOUTS[species.key] ?? 1;
  const tail = Arr.makeBy(5, (index) => {
    const along = (index + 1) / 5;
    return {
      at: [
        Math.sin(along * 2.4) * 0.05,
        0.045 * (1 - along) + 0.006,
        -0.1 - along * 0.38,
      ] as Vec,
      high: index === 4 ? 0 : 0.04 * (1 - along * 0.8),
      wide: index === 4 ? 0 : 0.05 * (1 - along * 0.8),
    };
  });
  const legs = [
    ...splayed([0.05, 0.05, 0.1], 0.02, coat),
    ...splayed([0.05, 0.05, -0.08], 0.022, coat),
  ];
  const head = 0.12 + 0.03 * snout;
  return [
    ...tube(
      [
        { at: [0, 0.06, 0.16], high: 0.048, wide: 0.058 },
        { at: [0, 0.066, 0.05], high: 0.058, wide: 0.075 },
        { at: [0, 0.062, -0.06], high: 0.054, wide: 0.068 },
        ...tail,
      ],
      coat.hide,
      6
    ),
    ...tube(
      [
        { at: [0, 0.064, 0.15], high: 0.042, wide: 0.05 },
        { at: [0, 0.066, 0.19], high: 0.04, wide: 0.046 },
        { at: [0, 0.052, 0.06 + head], high: 0.02, wide: 0.026 },
      ],
      coat.body,
      6
    ),
    ...legs,
    ...mirrored(legs),
    ...eyesOf(
      {
        eye: [0.04, 0.09, 0.19],
        jaw: [0, 0, 0],
        size: 0.07,
        top: [0, 0, 0],
        wide: 0.04,
      },
      coat
    ),
    ...(species.traits.crest
      ? slab(
          [
            [0, 0.08, 0.14],
            [0, 0.1, 0],
            [0, 0.06, -0.2],
            [0, 0.07, 0.12],
          ],
          0.01,
          coat.accent
        )
      : []),
  ];
}

/** The path of a coiled snake: two loose turns around its middle, the head rising from the center. */
function coilOf(): Arr.NonEmptyReadonlyArray<Vec> {
  const turns = Arr.makeBy(22, (index): Vec => {
    const angle = index * 0.6;
    const radius = 0.32 - index * 0.012;
    return [Math.cos(angle) * radius, 0.04, Math.sin(angle) * radius];
  });
  return [...turns, [0.02, 0.12, 0.02], [0.02, 0.2, 0.08]];
}

/** The path of a swimming snake: a wave along +z. */
function waveOf(): Arr.NonEmptyReadonlyArray<Vec> {
  return Arr.makeBy(
    14,
    (index): Vec => [Math.sin(index * 0.8) * 0.08, 0, -0.5 + index * 0.075]
  );
}

/** A path's length. */
function lengthOf(path: readonly Vec[]) {
  return Arr.reduce(
    Arr.drop(path, 1),
    { at: path[0], length: 0 },
    (walked, point) => ({
      at: point,
      length:
        walked.length +
        Math.hypot(
          point[0] - walked.at[0],
          point[1] - walked.at[1],
          point[2] - walked.at[2]
        ),
    })
  ).length;
}

/**
 * A snake (ADR 0047, D21) one long from tail to snout: coiled on the ground
 * with its head raised on land, or swimming in a wave at sea, centered on the
 * origin.
 */
export function snake(species: Species, coat: Coat): readonly Face[] {
  const raw = species.home === "sea" ? waveOf() : coilOf();
  const factor = 1 / lengthOf(raw);
  const path = Arr.map(
    raw,
    ([x, y, z]): Vec => [x * factor, y * factor, z * factor]
  );
  const thick = 0.016;
  const rings = Arr.map(path, (at, index) => ({
    at,
    high: index === 0 ? 0 : thick * Math.min(1, index / 4),
    wide: index === 0 ? 0 : thick * 1.15 * Math.min(1, index / 4),
  }));
  const [first, ...rest] = rings;
  const head = Arr.lastNonEmpty(path);
  return [
    ...tube([first, ...rest], coat.hide, 6),
    ...ball(
      [head[0], head[1], head[2] + thick],
      [thick * 1.5, thick * 1.1, thick * 2],
      coat.body,
      2,
      6
    ),
  ];
}

/** A frog or a toad (ADR 0047, D21), one long, crouched on the origin facing +z, with big eyes on top and folded hind legs. */
export function frog(_species: Species, coat: Coat): readonly Face[] {
  const legs = [
    ...rod([0.18, 0.12, -0.12], [0.3, 0.08, 0.05], [0.07, 0.05], coat.leg, 4),
    ...rod([0.3, 0.08, 0.05], [0.26, 0.02, -0.18], [0.05, 0.03], coat.leg, 4),
    ...rod([0.15, 0.16, 0.22], [0.18, 0, 0.3], [0.04, 0.03], coat.leg, 4),
    ...ball([0.13, 0.36, 0.26], [0.07, 0.07, 0.07], coat.body, 2, 6),
    ...ball([0.16, 0.38, 0.3], [0.035, 0.035, 0.03], coat.eye, 1, 6),
  ];
  return [
    ...ball([0, 0.2, 0.02], [0.22, 0.17, 0.32], coat.hide, 3, 6),
    ...ball([0, 0.26, 0.26], [0.17, 0.11, 0.15], coat.body, 2, 6),
    ...legs,
    ...mirrored(legs),
  ];
}
