import { Array as Arr } from "effect";
import {
  type Bloom,
  bushOf,
  dotsOver,
  leafOf,
  rosetteOf,
  stemOf,
} from "@/lib/island/models/blooms";
import type { Face } from "@/lib/island/models/parts";
import { ball, type Ring, rod, tint, tube } from "@/lib/island/models/solids";

/** Where a crop's stalks stand: a small clump around the middle. */
const CLUMP: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.14, 0.06],
  [-0.12, 0.1],
  [0.05, -0.14],
  [-0.1, -0.1],
  [0.16, -0.08],
];

/**
 * Each crop family drawn as a low-poly plant one tall (ADR 0047, D25),
 * standing on the origin: the catalog grows it to the crop's real height.
 */
export const CROPS = {
  /** Rice, wheat, barley: stalks bowing under their ripe heads. */
  grain: (bloom: Bloom) =>
    Arr.flatMap(CLUMP, ([x, z]) => [
      ...stemOf(x, z, 0.78, bloom, [x * 0.3, z * 0.3]),
      ...rod(
        [x * 1.3, 0.78, z * 1.3],
        [x * 1.3 + 0.1, 0.98, z * 1.3 + 0.04],
        [0.035, 0.012],
        bloom.petal,
        4
      ),
      ...leafOf([x, 0.2, z], [x * 2 + 0.12, 0.45, z * 2], 0.025, bloom.leaf),
    ]),
  /** Corn, sorghum, sugarcane: a tall cane with long leaves, a cob and a tassel. */
  corn: (bloom: Bloom) => [
    ...rod([0, 0, 0], [0, 0.92, 0], [0.035, 0.025], bloom.stem, 6),
    ...Arr.flatMap([0.2, 0.38, 0.56, 0.74], (y, index) => {
      const angle = index * 2.2;
      return leafOf(
        [0, y, 0],
        [Math.cos(angle) * 0.36, y + 0.12, Math.sin(angle) * 0.36],
        0.05,
        bloom.leaf
      );
    }),
    ...ball([0.06, 0.55, 0.02], [0.05, 0.11, 0.05], bloom.petal, 2, 6),
    ...rod([0, 0.92, 0], [0.03, 1, 0], [0.03, 0], bloom.heart, 4),
  ],
  /** Cabbage, lettuce, bok choy: a low round head of leaves with its outer leaves open. */
  leafy: (bloom: Bloom) => [
    ...ball(
      [0, 0.45, 0],
      [0.42, 0.42, 0.42],
      (spot) => (spot.up > 0.4 ? bloom.petal : bloom.heart),
      3,
      8
    ),
    ...rosetteOf(5, 0.08, 0.62, 0.35, 0.18, bloom.leaf, 0.3),
  ],
  /** Tomato, chili, beans: a vine climbing a stake, hung with fruit. */
  vine: (bloom: Bloom) => [
    ...rod([0, 0, 0], [0, 1, 0], [0.02, 0.018], tint("wood", 2), 4),
    ...tube(
      Arr.makeBy(
        6,
        (index): Ring => ({
          at: [
            Math.cos(index * 1.8) * 0.07,
            0.05 + index * 0.17,
            Math.sin(index * 1.8) * 0.07,
          ],
          high: 0.018,
          wide: 0.018,
        })
      ),
      bloom.stem,
      4
    ),
    ...Arr.flatMap([0.25, 0.5, 0.75], (y, index) =>
      leafOf(
        [0.04, y, 0],
        [Math.cos(index * 2.3) * 0.28, y + 0.08, Math.sin(index * 2.3) * 0.28],
        0.08,
        bloom.leaf
      )
    ),
    ...Arr.flatMap(dotsOver(4, 0.35, 0.2), (at) =>
      ball(at, [0.07, 0.08, 0.07], bloom.petal, 2, 6)
    ),
  ],
  /** Pumpkin, watermelon, strawberry: a vine sprawling over the ground with its fruit resting in its leaves. */
  sprawl: (bloom: Bloom) => [
    ...Arr.flatMap(
      Arr.makeBy(6, (index) => index),
      (index) => {
        const angle = index * 1.05;
        const [x, z] = [Math.cos(angle), Math.sin(angle)];
        return [
          ...rod(
            [0, 0.05, 0],
            [x * 0.8, 0.05, z * 0.8],
            [0.03, 0.02],
            bloom.stem,
            4
          ),
          ...leafOf(
            [x * 0.3, 0.08, z * 0.3],
            [x * 0.75, 0.5 + (index % 2) * 0.25, z * 0.75],
            0.2,
            bloom.leaf
          ),
        ];
      }
    ),
    ...ball(
      [0.3, 0.42, 0.25],
      [0.42, 0.42, 0.42],
      (spot) => (spot.side % 2 === 0 ? bloom.heart : bloom.petal),
      3,
      8
    ),
  ],
  /** Carrot, cassava, ginger: a fan of leaves over a root peeking from the soil. */
  root: (bloom: Bloom) => [
    ...ball([0, 0.06, 0], [0.14, 0.1, 0.14], bloom.petal, 2, 6),
    ...rosetteOf(6, 0.12, 0.3, 0.85, 0.07, bloom.leaf, 0.2),
  ],
  /** Coffee, tea, berries: a round bush dotted with fruit or flowers. */
  bush: (bloom: Bloom) => [
    ...stemOf(0, 0, 0.3, bloom),
    ...bushOf(0.55, 0.45, bloom),
    ...Arr.flatMap(dotsOver(8, 0.6, 0.44), (at) =>
      ball(
        at,
        [0.05, 0.05, 0.05],
        (spot) => (spot.up > 0 ? bloom.petal : bloom.heart),
        1,
        6
      )
    ),
  ],
  /** Basil, mint, lemongrass: small sprigs of leaves with flowers at their tips. */
  herb: (bloom: Bloom) =>
    Arr.flatMap(Arr.take(CLUMP, 5), ([x, z]) => [
      ...stemOf(x, z, 0.85, bloom, [x * 0.4, z * 0.4]),
      ...leafOf(
        [x * 1.2, 0.45, z * 1.2],
        [x * 2 + 0.12, 0.55, z * 2 + 0.05],
        0.05,
        bloom.leaf
      ),
      ...leafOf(
        [x * 1.3, 0.7, z * 1.3],
        [x * 2 - 0.1, 0.78, z * 2 - 0.06],
        0.05,
        bloom.leaf
      ),
      ...ball([x * 1.4, 0.9, z * 1.4], [0.04, 0.08, 0.04], bloom.petal, 1, 6),
    ]),
} satisfies Record<string, (bloom: Bloom) => readonly Face[]>;
