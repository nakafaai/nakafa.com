import { block, roof, row, toned, turned } from "@/lib/island/models/forms";
import { HUES } from "@/lib/island/models/hues";
import { doorOf, windowOf } from "@/lib/island/models/joinery";
import type { Face } from "@/lib/island/models/parts";
import { rod } from "@/lib/island/models/solids";

/** The spines of the books on a reading garden's shelves. */
const BOOKS = [
  HUES.red,
  HUES.yellow,
  HUES.teal,
  HUES.violet,
  HUES.blue,
  HUES.cream,
] as const;

/**
 * A cottage (pondok), 5.4 m by 4.4 m of wall under a clay tile hip roof whose
 * eaves overhang to 6.2 m by 5.2 m and whose ridge stands 5.5 m up: a stone
 * plinth, plaster walls between timber corner posts and wall plates, a plank
 * door in its frame over a porch step, a shuttered window on every side (two
 * at the front), and a stone chimney through the back slope.
 */
function cottageOf(): readonly Face[] {
  const shutters = HUES.teal;
  return [
    ...block([0, 0, 0], [5.7, 0.3, 4.7], HUES.stone),
    ...block([0, 0.3, 0], [5.4, 2.6, 4.4], HUES.wall),
    ...row(4, (index) =>
      block(
        [index % 2 === 0 ? -2.7 : 2.7, 0.3, index < 2 ? 2.2 : -2.2],
        [0.22, 2.6, 0.22],
        HUES.walnut
      )
    ),
    ...row(2, (index) =>
      block([0, 2.72, index === 0 ? 2.2 : -2.2], [5.6, 0.16, 0.16], HUES.walnut)
    ),
    ...block([0, 2.88, 0], [6.2, 0.2, 5.2], HUES.brick),
    ...roof([0, 3.08, 0], [6.2, 2.28, 5.2], 1.4, [
      HUES.red,
      toned(HUES.red, 0.88),
      HUES.dark,
    ]),
    ...block([0, 5.3, 0], [1.7, 0.2, 0.3], HUES.brick),
    ...block([1.5, 3.4, -0.8], [0.62, 2.35, 0.62], HUES.slate),
    ...block([1.5, 5.75, -0.8], [0.8, 0.12, 0.8], HUES.stone),
    ...doorOf([-0.1, 0.3, 2.2], 1),
    ...block([-0.1, 0, 2.6], [1.6, 0.17, 0.7], HUES.slate),
    ...windowOf([-1.75, 1.75, 2.2], [0.8, 1], shutters),
    ...windowOf([1.75, 1.75, 2.2], [0.8, 1], shutters),
    ...turned(windowOf([0, 1.75, 2.7], [0.8, 1], shutters), Math.PI / 2),
    ...turned(windowOf([0, 1.75, 2.7], [0.8, 1], shutters), -Math.PI / 2),
    ...turned(windowOf([0.4, 1.75, 2.2], [0.8, 1], shutters), Math.PI),
  ];
}

/**
 * A saung, 4 m by 4 m: an open bamboo pavilion whose floor of split bamboo
 * stands on stilts, with a rail round three sides, steps up its open front,
 * and a thatch roof in two tiers on four posts.
 */
function saungOf(): readonly Face[] {
  return [
    ...row(4, (index) => {
      const x = index % 2 === 0 ? -1.6 : 1.6;
      const z = index < 2 ? 1.6 : -1.6;
      return rod([x, 0, z], [x, 2.5, z], [0.08, 0.07], HUES.bamboo, 6);
    }),
    ...rod([0, 0, 0], [0, 0.6, 0], [0.08, 0.08], HUES.walnut, 4),
    ...row(6, (index) =>
      block(
        [0, 0.6, -1.5 + index * 0.6],
        [3.4, 0.08, 0.58],
        index % 2 === 0 ? HUES.bamboo : toned(HUES.bamboo, 0.88)
      )
    ),
    ...row(2, (index) => [
      ...block([0, 0.98 + index * 0.3, -1.6], [3.2, 0.06, 0.06], HUES.bamboo),
      ...block([-1.6, 0.98 + index * 0.3, 0], [0.06, 0.06, 3.2], HUES.bamboo),
      ...block([1.6, 0.98 + index * 0.3, 0], [0.06, 0.06, 3.2], HUES.bamboo),
    ]),
    ...block([0, 2.38, 0], [4.5, 0.1, 4.5], HUES.straw),
    ...roof([0, 2.48, 0], [4.4, 0.9, 4.4], 0, [
      HUES.thatch,
      toned(HUES.thatch, 0.9),
      HUES.dark,
    ]),
    ...roof([0, 3, 0], [2.6, 0.9, 2.6], 0, [
      toned(HUES.thatch, 1.08),
      HUES.thatch,
      HUES.straw,
    ]),
    ...block([0, 0, 2.08], [1, 0.2, 0.3], HUES.walnut),
    ...block([0, 0, 1.82], [1, 0.4, 0.24], HUES.wood),
  ];
}

/**
 * A reading garden (taman baca), 6 m by 5 m under its roof: a stone floor, a
 * back wall lined with a shelf of books, four posts holding a tiled gable
 * roof, and a table with an open book between two benches.
 */
function libraryOf(): readonly Face[] {
  return [
    ...block([0, 0, 0], [5.6, 0.25, 4.6], HUES.stone),
    ...block([0, 0.25, -2.1], [5.2, 2.4, 0.16], HUES.cream),
    ...row(4, (index) => {
      const x = index % 2 === 0 ? -2.5 : 2.5;
      const z = index < 2 ? 2 : -2.1;
      return rod([x, 0.25, z], [x, 2.65, z], [0.1, 0.09], HUES.walnut, 6);
    }),
    ...row(2, (index) =>
      block([0, 2.55, index === 0 ? 2 : -2.1], [5.4, 0.14, 0.14], HUES.walnut)
    ),
    ...roof([0, 2.69, 0], [6.2, 1.35, 5.2], 6.2, [
      HUES.blue,
      HUES.wall,
      HUES.dark,
    ]),
    ...block([0, 3.98, 0], [6.4, 0.14, 0.22], HUES.navy),
    ...row(2, (index) =>
      block(
        [index === 0 ? -2.04 : 2.04, 0.25, -1.84],
        [0.08, 2.03, 0.36],
        HUES.walnut
      )
    ),
    ...row(4, (index) =>
      block([0, 0.3 + index * 0.55, -1.84], [4, 0.06, 0.34], HUES.wood)
    ),
    ...row(12, (index) => {
      const shelf = Math.floor(index / 4);
      const place = index % 4;
      return block(
        [-1.47 + place * 0.98, 0.36 + shelf * 0.55, -1.84],
        [0.9, 0.32 + ((place + shelf) % 3) * 0.05, 0.26],
        BOOKS[(place * 2 + shelf) % 6]
      );
    }),
    ...row(2, (index) =>
      block([index === 0 ? -0.7 : 0.7, 0.25, 0.5], [0.1, 0.7, 0.6], HUES.walnut)
    ),
    ...block([0, 0.95, 0.5], [1.8, 0.07, 0.8], HUES.wood),
    ...block([0.3, 1.02, 0.5], [0.4, 0.04, 0.28], HUES.white),
    ...row(2, (index) => {
      const z = index === 0 ? -0.3 : 1.3;
      return [
        ...block([0, 0.65, z], [1.6, 0.06, 0.3], HUES.oak),
        ...block([-0.6, 0.25, z], [0.08, 0.4, 0.26], HUES.walnut),
        ...block([0.6, 0.25, z], [0.08, 0.4, 0.26], HUES.walnut),
      ];
    }),
    ...block([0, 2.2, 0.5], [0.2, 0.24, 0.2], HUES.glow),
  ];
}

/** Every dwelling and pavilion by its kind, each built in meters, standing on the origin with its front toward +z. */
export const HOMES = {
  cottage: cottageOf,
  library: libraryOf,
  saung: saungOf,
} satisfies Record<string, () => readonly Face[]>;
