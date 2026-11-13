import { Array as Arr } from "effect";
import { type Bloom, leafOf, rosetteOf } from "@/lib/island/models/blooms";
import type { Face } from "@/lib/island/models/parts";
import { ball, rod, tube } from "@/lib/island/models/solids";

/**
 * Each family of ferns, grasses, cacti, succulents and broad-leaved plants
 * drawn as a low-poly plant one tall (ADR 0047, D25), standing on the origin:
 * the catalog grows it to the species' real height.
 */
export const GREENS = {
  /** A fern: fronds arching out from the ground. */
  fern: (bloom: Bloom) => [
    ...rosetteOf(7, 0.02, 0.62, 0.95, 0.09, bloom.leaf, 0.2),
    ...rosetteOf(5, 0.02, 0.3, 0.6, 0.06, bloom.heart, 0.9),
  ],
  /** Tall grass, reeds, cattails: blades with seed heads. */
  grass: (bloom: Bloom) =>
    Arr.flatMap(
      Arr.makeBy(7, (index) => index),
      (index) => {
        const angle = index * 2.6;
        const out = 0.06 + (index % 3) * 0.05;
        const top = 0.75 + (index % 2) * 0.2;
        const [x, z] = [Math.cos(angle) * out, Math.sin(angle) * out];
        return [
          ...leafOf(
            [x * 0.3, 0, z * 0.3],
            [x * 3, top, z * 3],
            0.025,
            index % 3 === 0 ? bloom.heart : bloom.leaf
          ),
          ...(index % 2 === 0
            ? rod(
                [x * 2.6, top * 0.8, z * 2.6],
                [x * 3.2, top, z * 3.2],
                [0.03, 0.012],
                bloom.petal,
                4
              )
            : []),
        ];
      }
    ),
  /** A saguaro, a prickly pear: a ribbed column with arms and a flower on top. */
  cactus: (bloom: Bloom) => [
    ...tube(
      [
        { at: [0, 0, 0], high: 0.13, wide: 0.13 },
        { at: [0, 0.85, 0], high: 0.12, wide: 0.12 },
        { at: [0, 0.95, 0], high: 0.07, wide: 0.07 },
      ],
      (spot) => (spot.side % 2 === 0 ? bloom.leaf : bloom.stem),
      8
    ),
    ...tube(
      [
        { at: [0.1, 0.38, 0], high: 0.07, wide: 0.07 },
        { at: [0.28, 0.42, 0], high: 0.07, wide: 0.07 },
        { at: [0.3, 0.72, 0], high: 0.06, wide: 0.06 },
      ],
      bloom.leaf,
      6
    ),
    ...tube(
      [
        { at: [-0.1, 0.5, 0.02], high: 0.06, wide: 0.06 },
        { at: [-0.24, 0.52, 0.04], high: 0.06, wide: 0.06 },
        { at: [-0.25, 0.74, 0.04], high: 0.05, wide: 0.05 },
      ],
      bloom.leaf,
      6
    ),
    ...ball([0, 0.97, 0], [0.07, 0.04, 0.07], bloom.heart, 1, 6),
  ],
  /** Aloe, agave, echeveria: a rosette of thick pointed leaves. */
  succulent: (bloom: Bloom) => [
    ...Arr.flatMap(
      Arr.makeBy(8, (index) => index),
      (index) => {
        const angle = index * 0.785 + 0.2;
        const rise = index % 2 === 0 ? 1 : 0.62;
        return rod(
          [0, 0.05, 0],
          [Math.cos(angle) * 0.42, rise, Math.sin(angle) * 0.42],
          [0.07, 0],
          bloom.leaf,
          4
        );
      }
    ),
    ...ball([0, 0.12, 0], [0.12, 0.1, 0.12], bloom.petal, 1, 6),
  ],
  /** A banana, a pineapple, a taro: broad leaves from a short trunk, with its fruit. */
  broad: (bloom: Bloom) => [
    ...rod([0, 0, 0], [0, 0.55, 0], [0.07, 0.05], bloom.stem, 6),
    ...Arr.flatMap(
      Arr.makeBy(5, (index) => index),
      (index) => {
        const angle = index * 1.26;
        return leafOf(
          [0, 0.52, 0],
          [
            Math.cos(angle) * 0.5,
            0.95 - (index % 2) * 0.2,
            Math.sin(angle) * 0.5,
          ],
          0.14,
          bloom.leaf
        );
      }
    ),
    ...ball([0.08, 0.45, 0.04], [0.1, 0.14, 0.1], bloom.petal, 2, 6),
  ],
} satisfies Record<string, (bloom: Bloom) => readonly Face[]>;
