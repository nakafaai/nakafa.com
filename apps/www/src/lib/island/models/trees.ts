import {
  around,
  dome,
  lobe,
  row,
  toned,
  turned,
} from "@/lib/island/models/forms";
import { HUES } from "@/lib/island/models/hues";
import type { Face, Rgb, Vec } from "@/lib/island/models/parts";
import { rgb } from "@/lib/island/models/parts";
import type { Spot } from "@/lib/island/models/solids";
import { add, outward, rod, times, tube } from "@/lib/island/models/solids";

/** A casuarina's needles, grey-green as a cemara laut's are: in shade, plain and in the sun. */
const NEEDLES = [rgb(0x35_5e_45), rgb(0x4d_7a_56), rgb(0x6c_9a_66)] as const;

/** A broad-leaved crown's greens: in shade, plain and in the sun. */
const LEAVES = [HUES.moss, HUES.leaf, HUES.lime] as const;

/** The paint of one lobe of a crown, a shade `by` lighter or darker than its neighbours: its underside in shade and its top in the sun. */
function foliage(greens: readonly Rgb[], by: number) {
  return (spot: Spot) => {
    if (spot.along < 0.34) {
      return toned(greens[0], by);
    }
    return toned(spot.along > 0.66 ? greens[2] : greens[1], by);
  };
}

/**
 * A trunk rising `high` from a flared foot, `thick` at its waist and thinner
 * at its top, bowing toward `lean` as it climbs, its bark in two tones.
 */
function trunkOf(
  high: number,
  thick: number,
  lean: readonly [number, number],
  bark: Rgb
) {
  const at = (share: number): Vec => [
    lean[0] * share * share,
    high * share,
    lean[1] * share * share,
  ];
  return tube(
    [
      { at: [0, 0, 0], high: thick * 1.5, wide: thick * 1.5 },
      { at: [0, high * 0.12, 0], high: thick, wide: thick },
      { at: at(0.6), high: thick * 0.85, wide: thick * 0.85 },
      { at: at(1), high: thick * 0.7, wide: thick * 0.7 },
    ],
    (spot) => (spot.side % 2 === 0 ? bark : toned(bark, 0.86)),
    6
  );
}

/**
 * One skirt of a conifer's boughs standing on `foot`: `wide` at its hem,
 * drawn in above it and `tall` to its point, dark underneath, its hem in two
 * tones `step` apart and its shoulder in the lighter `tip`.
 */
function skirt(
  foot: Vec,
  [wide, tall]: readonly [number, number],
  [hem, tip]: readonly [Rgb, Rgb],
  step: number,
  sides: number
) {
  const [x, y, z] = foot;
  return tube(
    [
      { at: foot, high: wide, wide },
      { at: [x, y + tall * 0.4, z], high: wide * 0.5, wide: wide * 0.5 },
      { at: [x, y + tall, z], high: 0, wide: 0 },
    ],
    (spot) => {
      if (spot.side < 0) {
        return toned(hem, 0.7);
      }
      if (spot.segment === 1) {
        return tip;
      }
      return (spot.side + step) % 2 === 0 ? hem : toned(hem, 1.16);
    },
    sides
  );
}

/** Each look of a mango: its height, its lean, how many lobes ring its crown and how far the crown reaches. */
const MANGO = [
  { high: 7.6, lean: [0.25, 0.1], lobes: 5, reach: 3, turn: 0.3 },
  { high: 7, lean: [-0.4, 0.2], lobes: 4, reach: 2.8, turn: 1.1 },
  { high: 8.1, lean: [0.1, -0.35], lobes: 6, reach: 3.2, turn: 2 },
] as const;

/** A mango tree: a stout trunk forking into three limbs under a broad dome of lobes, with fruit hanging under its rim. */
function mangoOf(look: number): readonly Face[] {
  const { high, lean, lobes, reach, turn } = MANGO[look];
  const fork: Vec = [lean[0], high * 0.42, lean[1]];
  const rim = (angle: number, out: number, up: number): Vec =>
    add(fork, add(times(outward(angle), reach * out), [0, up, 0]));
  return [
    ...trunkOf(fork[1], 0.3, lean, HUES.trunk),
    ...around(3, turn, (angle) =>
      rod(fork, rim(angle, 0.42, high * 0.2), [0.17, 0.08], HUES.bark, 3)
    ),
    ...around(lobes, turn, (angle, index) => {
      const size = reach * 0.52 * (1 - (index % 3) * 0.06);
      return [
        ...dome(
          rim(angle, 0.55, high * 0.24 + (index % 2) * 0.35),
          [size, size * 0.72, size],
          foliage(LEAVES, 1 - (index % 2) * 0.07),
          5
        ),
        ...(index < 2
          ? lobe(
              rim(angle + 0.2, 0.78, high * 0.24 - reach * 0.36),
              [0.12, 0.17, 0.12],
              HUES.ember,
              1,
              4
            )
          : []),
      ];
    }),
    ...dome(
      [lean[0], high - reach * 0.42, lean[1]],
      [reach * 0.62, reach * 0.42, reach * 0.62],
      foliage(LEAVES, 1.05),
      6
    ),
  ];
}

/** Each look of a flamboyant: its height, its lean, how many lobes ring its crown and how far the crown reaches. */
const FLAME = [
  { high: 8, lean: [0.5, 0.2], lobes: 5, reach: 4.4, turn: 0.2 },
  { high: 7.4, lean: [-0.6, 0.1], lobes: 4, reach: 4.1, turn: 1 },
  { high: 8.6, lean: [0.3, -0.5], lobes: 6, reach: 4.7, turn: 2.2 },
] as const;

/** A flamboyant's lobe in bloom: green underneath, its top red or orange with blossom, and blossom breaking through its sides. */
function blossom(index: number) {
  return (spot: Spot) => {
    if (spot.along < 0.3) {
      return HUES.moss;
    }
    if (spot.along > 0.7) {
      return index % 2 === 0 ? HUES.flame : HUES.ember;
    }
    if ((spot.side + index) % 3 === 0) {
      return index % 2 === 0 ? HUES.ember : HUES.flame;
    }
    return spot.side % 2 === 0 ? HUES.leaf : HUES.lime;
  };
}

/** A flamboyant: a leaning trunk whose long limbs hold up a wide, flat umbrella of a crown, red with blossom on top. */
function flameOf(look: number): readonly Face[] {
  const { high, lean, lobes, reach, turn } = FLAME[look];
  const fork: Vec = [lean[0], high * 0.5, lean[1]];
  const size = reach * 0.44;
  const rim = (angle: number, out: number, drop: number): Vec => [
    lean[0] + Math.cos(angle) * reach * out,
    high - drop,
    lean[1] + Math.sin(angle) * reach * out,
  ];
  return [
    ...trunkOf(fork[1], 0.3, lean, HUES.bark),
    ...around(lobes, turn, (angle, index) => [
      ...rod(fork, rim(angle, 0.5, reach * 0.3), [0.16, 0.07], HUES.bark, 3),
      ...dome(
        rim(angle, 0.56, size * 0.42 + (index % 2) * 0.35),
        [size, size * 0.42, size],
        blossom(index),
        5
      ),
    ]),
    ...dome(
      [lean[0], high - reach * 0.21, lean[1]],
      [reach * 0.5, reach * 0.21, reach * 0.5],
      blossom(1),
      6
    ),
  ];
}

/** Each look of a casuarina: its height, its lean and how many tufts of needles hang down its trunk. */
const CASUARINA = [
  { high: 9, lean: [0.2, 0], tufts: 6, turn: 0.5 },
  { high: 8.3, lean: [-0.3, 0.15], tufts: 5, turn: 1.7 },
  { high: 9.7, lean: [0.1, -0.25], tufts: 7, turn: 2.9 },
] as const;

/** A casuarina (cemara laut): a slim trunk to its tip, drooping tufts of needles hanging round it out of line with one another, each smaller than the one below, and a spire on top. */
function casuarinaOf(look: number): readonly Face[] {
  const { high, lean, tufts, turn } = CASUARINA[look];
  return [
    ...trunkOf(high * 0.9, 0.17, lean, HUES.bark),
    ...row(tufts, (index) => {
      const share = 0.25 + (0.6 * index) / (tufts - 1);
      const out = times(outward(turn + index * 2.4), 0.42 * (1 - share * 0.7));
      return skirt(
        [
          lean[0] * share * share + out[0],
          high * share,
          lean[1] * share * share + out[2],
        ],
        [1.2 - share * 0.85, high * (0.24 - share * 0.12)],
        [NEEDLES[index % 2], NEEDLES[2]],
        index,
        5
      );
    }),
    ...skirt(
      [lean[0] * 0.74, high * 0.86, lean[1] * 0.74],
      [0.36, high * 0.14],
      [NEEDLES[1], NEEDLES[2]],
      0,
      5
    ),
  ];
}

/** Each look of a highland pine: its height and how many tiers of boughs it carries. */
const PINE = [
  { high: 10, tiers: 5, turn: 0 },
  { high: 9.2, tiers: 4, turn: 0.4 },
  { high: 10.8, tiers: 6, turn: 0.8 },
] as const;

/** A highland pine: a straight trunk under tiers of boughs, each a skirt that flares at its hem and narrows to the next, the highest a point. */
function pineOf(look: number): readonly Face[] {
  const { high, tiers, turn } = PINE[look];
  const bare = high * 0.17;
  const tall = high * 0.27;
  const step = (high - bare - tall) / (tiers - 1);
  return [
    ...trunkOf(high * 0.9, 0.24, [0, 0], HUES.bark),
    ...row(tiers, (index) => {
      const foot = bare + index * step;
      const wide = high * 0.23 * (1 - (0.7 * index) / (tiers - 1));
      return turned(
        skirt([0, foot, 0], [wide, tall], [HUES.pine, HUES.fir], index, 7),
        turn + index * 0.45
      );
    }),
  ];
}

/** Every branching tree by its kind, each built in meters from its look, standing on the origin. */
export const TREES = {
  casuarina: casuarinaOf,
  flame: flameOf,
  mango: mangoOf,
  pine: pineOf,
} satisfies Record<string, (look: number) => readonly Face[]>;
