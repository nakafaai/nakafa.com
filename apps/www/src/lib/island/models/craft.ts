import { block, hoop, row, toned } from "@/lib/island/models/forms";
import { HUES } from "@/lib/island/models/hues";
import type { Face, Rig, Vec } from "@/lib/island/models/parts";
import { rgb, rigged } from "@/lib/island/models/parts";
import type { Spot } from "@/lib/island/models/solids";
import { add, rod, slab, tube } from "@/lib/island/models/solids";

/** A hot-air balloon's gores round its envelope, and its wicker basket. */
const GORES = [
  HUES.red,
  HUES.cream,
  HUES.yellow,
  HUES.cream,
  HUES.teal,
  HUES.cream,
] as const;
const WICKER = rgb(0xb8_8a_4a);

/**
 * How a kite and a tethered balloon ride the air: rooted where their line
 * meets the ground, swinging more the higher up, so a kite's line stays
 * straight as the kite tugs at it and a balloon's basket hardly stirs.
 */
const AIR = {
  balloon: {
    mode: "lean",
    phase: 0,
    pivot: 0,
    rate: 0.5,
    reach: 0.008,
    waves: 0,
  },
  kite: { mode: "lean", phase: 0, pivot: 0, rate: 1.6, reach: 0.035, waves: 0 },
} satisfies Record<string, Rig>;

/** A jukung's hull: its deck pale wood, its ends red, its sides white over a dark keel. */
function hullPaint(spot: Spot) {
  if (spot.up > 0.5) {
    return HUES.oak;
  }
  if (spot.along < 0.25 || spot.along > 0.75) {
    return HUES.red;
  }
  return spot.up < -0.5 ? HUES.walnut : HUES.white;
}

/**
 * A jukung, 5 m from stern to bow: a slim canoe whose ends rise to points,
 * two thwarts, two crossbeams arching out to a bamboo float on either side,
 * and a mast with its sail furled along a slanting yard. Its bow points to
 * the front.
 */
function boatOf(): readonly Face[] {
  return [
    ...tube(
      [
        { at: [0, 0.62, -2.5], high: 0, wide: 0 },
        { at: [0, 0.36, -1.7], high: 0.2, wide: 0.2 },
        { at: [0, 0.25, 0], high: 0.28, wide: 0.36 },
        { at: [0, 0.36, 1.7], high: 0.2, wide: 0.2 },
        { at: [0, 0.66, 2.5], high: 0, wide: 0 },
      ],
      hullPaint,
      6
    ),
    ...row(2, (index) => {
      const z = index === 0 ? -1 : 1;
      const x = index === 0 ? -1.35 : 1.35;
      return [
        ...block([0, 0.49, z * 0.6], [0.6, 0.05, 0.2], HUES.walnut),
        ...tube(
          [
            { at: [-1.35, 0.14, z], high: 0.045, wide: 0.045 },
            { at: [-0.8, 0.5, z], high: 0.045, wide: 0.045 },
            { at: [0, 0.56, z], high: 0.045, wide: 0.045 },
            { at: [0.8, 0.5, z], high: 0.045, wide: 0.045 },
            { at: [1.35, 0.14, z], high: 0.045, wide: 0.045 },
          ],
          HUES.bamboo,
          4
        ),
        ...tube(
          [
            { at: [x, 0.2, -1.9], high: 0, wide: 0 },
            { at: [x, 0.09, -1.2], high: 0.08, wide: 0.08 },
            { at: [x, 0.09, 1.2], high: 0.08, wide: 0.08 },
            { at: [x, 0.22, 1.9], high: 0, wide: 0 },
          ],
          toned(HUES.bamboo, 0.9),
          5
        ),
      ];
    }),
    ...rod([0, 0.45, 0.5], [0, 3.3, 0.5], [0.05, 0.035], HUES.wood, 5),
    ...tube(
      [
        { at: [0.08, 1.1, 1.6], high: 0, wide: 0 },
        { at: [0.08, 1.63, 0.9], high: 0.09, wide: 0.09 },
        { at: [0.08, 2.15, 0.2], high: 0.11, wide: 0.11 },
        { at: [0.08, 2.68, -0.5], high: 0.09, wide: 0.09 },
        { at: [0.08, 3.2, -1.2], high: 0, wide: 0 },
      ],
      (spot) => (spot.segment % 2 === 0 ? HUES.white : HUES.red),
      5
    ),
  ];
}

/**
 * A diamond kite, 1 m from nose to tail tip, flying 6 m up on a line from a
 * reel staked in the ground: two colors across its spars, and a tail of four
 * bows hanging under it.
 */
function kiteOf(): readonly Face[] {
  const tilt = 0.5;
  const fly: Vec = [0, 6, -1.5];
  const on = (across: number, up: number, back: number): Vec =>
    add(fly, [
      across,
      up * Math.cos(tilt) - back * Math.sin(tilt),
      up * Math.sin(tilt) + back * Math.cos(tilt),
    ]);
  const tail = on(0, -0.6, 0);
  return [
    ...block([0, 0, 0], [0.06, 0.3, 0.06], HUES.walnut),
    ...rod([-0.09, 0.16, 0], [0.09, 0.16, 0], [0.06, 0.06], HUES.rope, 6),
    ...rigged(
      [
        ...rod([0, 0.16, 0], on(0, 0.1, 0.02), [0.006, 0.006], HUES.white, 3),
        ...row(4, (index) => {
          const corners = [
            on(0, 0.4, 0),
            on(-0.36, 0.1, 0),
            tail,
            on(0.36, 0.1, 0),
          ];
          return slab(
            [on(0, 0.1, 0), corners[index], corners[(index + 1) % 4]],
            0.02,
            index % 2 === 0 ? HUES.red : HUES.yellow
          );
        }),
        ...rod(
          on(0, -0.6, -0.02),
          on(0, 0.4, -0.02),
          [0.012, 0.012],
          HUES.walnut,
          3
        ),
        ...rod(
          on(-0.36, 0.1, -0.02),
          on(0.36, 0.1, -0.02),
          [0.012, 0.012],
          HUES.walnut,
          3
        ),
        ...rod(tail, add(tail, [0, -1.3, 0]), [0.008, 0.008], HUES.white, 3),
        ...row(4, (index) => {
          const at = add(tail, [
            index % 2 === 0 ? -0.05 : 0.05,
            -0.3 * (index + 1),
            0,
          ]);
          return slab(
            [
              add(at, [-0.09, 0, 0]),
              add(at, [0, -0.06, 0]),
              add(at, [0.09, 0, 0]),
              add(at, [0, 0.06, 0]),
            ],
            0.012,
            index % 2 === 0 ? HUES.blue : HUES.yellow
          );
        }),
      ],
      AIR.kite
    ),
  ];
}

/**
 * A hot-air balloon, 12 m to its crown, tethered with its basket on the
 * ground: an envelope of twelve gores in alternating colors over a dark
 * mouth, a burner on its frame, and four lines down to a wicker basket.
 */
function balloonOf(): readonly Face[] {
  return rigged(
    [
      ...tube(
        [
          { at: [0, 3.3, 0], high: 0.9, wide: 0.9 },
          { at: [0, 4.6, 0], high: 2.2, wide: 2.2 },
          { at: [0, 6.4, 0], high: 3.5, wide: 3.5 },
          { at: [0, 8.3, 0], high: 4, wide: 4 },
          { at: [0, 10.2, 0], high: 3.5, wide: 3.5 },
          { at: [0, 11.4, 0], high: 2.2, wide: 2.2 },
          { at: [0, 12, 0], high: 0, wide: 0 },
        ],
        (spot) => {
          if (spot.side < 0) {
            return HUES.dark;
          }
          return spot.segment === 0 ? HUES.brick : GORES[spot.side % 6];
        },
        12
      ),
      ...hoop([0, 0, 0], [0.65, 0.65], 0.06, 1.05, [WICKER, HUES.walnut], 4),
      ...block([0, 0.02, 0], [1.2, 0.06, 1.2], HUES.walnut),
      ...block([0, 2.3, 0], [0.5, 0.06, 0.5], HUES.iron),
      ...block([0, 2.36, 0], [0.24, 0.4, 0.24], HUES.ember, 0.6),
      ...row(4, (index) => {
        const x = index % 2 === 0 ? -0.6 : 0.6;
        const z = index < 2 ? 0.6 : -0.6;
        return rod([x, 1.05, z], [x, 3.35, z], [0.02, 0.02], HUES.rope, 3);
      }),
    ],
    AIR.balloon
  );
}

/** Everything that floats or flies by its kind, each built in meters, standing on the origin with its front toward +z. */
export const CRAFT = {
  balloon: balloonOf,
  boat: boatOf,
  kite: kiteOf,
} satisfies Record<string, () => readonly Face[]>;
