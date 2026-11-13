import { Array as Arr } from "effect";
import {
  type Bloom,
  bushOf,
  dotsOver,
  headOf,
  leafOf,
  rosetteOf,
  stemOf,
} from "@/lib/island/models/blooms";
import { type Face, mirrored, type Vec } from "@/lib/island/models/parts";
import { ball, rod, tube } from "@/lib/island/models/solids";

/** A cup of petals opening upward from `y`, `r` across: a tulip's, a lotus's. */
function cupOf(at: Vec, r: number, color: Face["color"]): readonly Face[] {
  const [x, y, z] = at;
  return tube(
    [
      { at: [x, y, z], high: r * 0.45, wide: r * 0.45 },
      { at: [x, y + r * 0.9, z], high: r, wide: r },
      { at: [x, y + r * 1.7, z], high: r * 0.8, wide: r * 0.8 },
    ],
    color,
    6
  );
}

/** A trumpet from `from` opening toward `to`. */
function trumpetOf(
  from: Vec,
  to: Vec,
  r: number,
  bloom: Bloom
): readonly Face[] {
  return [
    ...rod(from, to, [r * 0.25, r], bloom.petal, 6),
    ...rod(
      to,
      [to[0], to[1] + r * 0.4, to[2] + r * 0.4],
      [r * 0.12, r * 0.1],
      bloom.heart,
      4
    ),
  ];
}

/**
 * Each flower family drawn as a low-poly plant one tall (ADR 0047, D25),
 * standing on the origin: the catalog grows it to the species' real height.
 */
export const FLOWERS = {
  /** A rose, a peony: a leafy bush crowned with full round blooms. */
  round: (bloom: Bloom) => [
    ...bushOf(0.42, 0.36, bloom),
    ...stemOf(0, 0, 0.3, bloom),
    ...Arr.flatMap(dotsOver(4, 0.6, 0.34), (at) =>
      ball(at, [0.1, 0.09, 0.1], bloom.petal, 2, 6)
    ),
  ],
  /** A tulip, a crocus, a poppy: a cup on a straight stem between two long leaves. */
  cup: (bloom: Bloom) => [
    ...stemOf(0, 0, 0.72, bloom),
    ...leafOf([0, 0.02, 0], [0.16, 0.5, 0.05], 0.06, bloom.leaf),
    ...leafOf([0, 0.02, 0], [-0.14, 0.42, -0.06], 0.06, bloom.leaf),
    ...cupOf([0, 0.7, 0], 0.13, bloom.petal),
  ],
  /** A daisy, an aster, a marigold: a ring of petals around a bright heart, facing up. */
  daisy: (bloom: Bloom) => [
    ...stemOf(0, 0, 0.9, bloom),
    ...rosetteOf(3, 0.02, 0.22, 0.12, 0.06, bloom.leaf),
    ...headOf([0, 0.92, 0], 0.22, bloom),
  ],
  /** A frangipani, a jasmine: a small shrub dotted with five-petalled stars. */
  star: (bloom: Bloom) => [
    ...stemOf(0, 0, 0.45, bloom),
    ...bushOf(0.6, 0.4, bloom),
    ...Arr.flatMap(dotsOver(5, 0.66, 0.38), (at) => headOf(at, 0.11, bloom)),
  ],
  /** A bluebell, a snowdrop: bells hanging from an arching stem over its leaves. */
  bell: (bloom: Bloom) => [
    ...tube(
      [
        { at: [0, 0, 0], high: 0.02, wide: 0.02 },
        { at: [0.05, 0.75, 0], high: 0.016, wide: 0.016 },
        { at: [0.3, 0.9, 0], high: 0.012, wide: 0.012 },
      ],
      bloom.stem,
      4
    ),
    ...rosetteOf(3, 0.02, 0.18, 0.3, 0.05, bloom.leaf, 0.5),
    ...Arr.flatMap([0.12, 0.22, 0.32], (x) =>
      rod(
        [x, 0.86 - x * 0.2, 0],
        [x, 0.7 - x * 0.2, 0],
        [0.025, 0.06],
        bloom.petal,
        6
      )
    ),
  ],
  /** A lavender, a lupine: a tall spike of small flowers over leaves. */
  spike: (bloom: Bloom) => [
    ...stemOf(0, 0, 0.5, bloom),
    ...rosetteOf(4, 0.05, 0.2, 0.15, 0.05, bloom.leaf),
    ...tube(
      [
        { at: [0, 0.45, 0], high: 0.07, wide: 0.07 },
        { at: [0, 0.75, 0], high: 0.06, wide: 0.06 },
        { at: [0, 1, 0], high: 0, wide: 0 },
      ],
      (spot) => (spot.segment === 0 && spot.up < 0 ? bloom.heart : bloom.petal),
      6
    ),
  ],
  /** A hydrangea, an ixora: round heads of tiny flowers over a leafy bush. */
  cluster: (bloom: Bloom) => [
    ...bushOf(0.45, 0.42, bloom),
    ...Arr.flatMap(dotsOver(5, 0.66, 0.4), (at) =>
      ball(
        at,
        [0.14, 0.12, 0.14],
        (spot) => (spot.side % 2 === 0 ? bloom.heart : bloom.petal),
        2,
        6
      )
    ),
  ],
  /** A hibiscus, a lily: wide trumpets with their long hearts showing, over a shrub. */
  trumpet: (bloom: Bloom) => {
    const bud = trumpetOf([0.18, 0.62, 0.18], [0.3, 0.74, 0.32], 0.12, bloom);
    return [
      ...stemOf(0, 0, 0.4, bloom),
      ...bushOf(0.55, 0.36, bloom),
      ...bud,
      ...mirrored(bud),
      ...trumpetOf([0, 0.82, -0.1], [0, 0.98, -0.2], 0.12, bloom),
    ];
  },
  /** A sunflower, a hollyhock: a tall stem raising a big head that faces the sun. */
  tall: (bloom: Bloom) => [
    ...rod([0, 0, 0], [0, 0.84, 0.02], [0.03, 0.022], bloom.stem, 6),
    ...leafOf([0, 0.3, 0], [0.22, 0.4, 0.04], 0.08, bloom.leaf),
    ...leafOf([0, 0.5, 0], [-0.2, 0.6, -0.04], 0.08, bloom.leaf),
    ...ball([0, 0.86, 0.04], [0.15, 0.15, 0.03], bloom.petal, 1, 10),
    ...ball([0, 0.86, 0.07], [0.08, 0.08, 0.025], bloom.heart, 1, 8),
  ],
  /** An orchid: broad leaves at its foot and an arching spray of blooms. */
  orchid: (bloom: Bloom) => [
    ...rosetteOf(3, 0.03, 0.3, 0.05, 0.1, bloom.leaf, 0.3),
    ...tube(
      [
        { at: [0, 0.02, 0], high: 0.012, wide: 0.012 },
        { at: [0.05, 0.7, 0], high: 0.01, wide: 0.01 },
        { at: [0.3, 0.86, 0], high: 0.008, wide: 0.008 },
      ],
      bloom.stem,
      4
    ),
    ...Arr.flatMap(
      [
        [0.12, 0.84, 0.03],
        [0.3, 0.84, 0.03],
      ] as const,
      (at) => headOf(at, 0.12, bloom)
    ),
  ],
  /** A lotus, a water lily: a cup of petals over round leaves that float on the water. */
  lotus: (bloom: Bloom) => [
    ...ball([0.15, 0.02, 0.1], [0.32, 0.02, 0.32], bloom.leaf, 1, 10),
    ...ball([-0.25, 0.02, -0.18], [0.22, 0.02, 0.22], bloom.leaf, 1, 8),
    ...stemOf(0, 0, 0.62, bloom),
    ...cupOf([0, 0.6, 0], 0.17, bloom.petal),
    ...ball([0, 0.8, 0], [0.07, 0.05, 0.07], bloom.heart, 1, 6),
  ],
} satisfies Record<string, (bloom: Bloom) => readonly Face[]>;
