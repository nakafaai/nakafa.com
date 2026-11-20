import {
  around,
  block,
  hoop,
  leaf,
  lobe,
  row,
  toned,
  turned,
} from "@/lib/island/models/forms";
import { HUES } from "@/lib/island/models/hues";
import type { Face, Rgb, Vec } from "@/lib/island/models/parts";
import { rgb } from "@/lib/island/models/parts";
import type { Spot } from "@/lib/island/models/solids";
import {
  add,
  outward,
  rod,
  slab,
  times,
  tube,
  unit,
} from "@/lib/island/models/solids";

/** A reed's two greens and a cattail's brown head. */
const REEDS = [rgb(0x7f_a2_4a), rgb(0x5f_8a_3e)] as const;
const CATTAIL = rgb(0x6b_44_28);

/** The flowers a bed is planted with, in the order they stand. */
const BLOOMS = [
  HUES.pink,
  HUES.yellow,
  HUES.violet,
  HUES.white,
  HUES.red,
] as const;

/** Each look of a berry bush: how much bigger or smaller it grows, how many lobes ring its middle and how many berries show. */
const BUSH = [
  { berries: 5, grow: 1, lobes: 2, turn: 0.4 },
  { berries: 3, grow: 0.9, lobes: 3, turn: 1.6 },
  { berries: 6, grow: 1.08, lobes: 2, turn: 2.8 },
] as const;

/** One mound of a bush on the ground at (`x`, `z`), `wide` at its belly and `high` to its point, a shade `by` lighter or darker than its neighbours: dark at its foot, its top in the sun. */
function mound(
  [x, z]: readonly [number, number],
  wide: number,
  high: number,
  by: number
) {
  return tube(
    [
      { at: [x, 0, z], high: wide * 0.8, wide: wide * 0.8 },
      { at: [x, high * 0.32, z], high: wide, wide },
      { at: [x, high * 0.78, z], high: wide * 0.62, wide: wide * 0.62 },
      { at: [x, high, z], high: 0, wide: 0 },
    ],
    (spot: Spot) => {
      if (spot.along < 0.34) {
        return toned(HUES.moss, by);
      }
      return toned(spot.along > 0.66 ? HUES.lime : HUES.leaf, by);
    },
    5
  );
}

/** A berry bush: a tall mound of leaves with smaller ones pushed out round it, and red berries on its belly and over its top. */
function bushOf(look: number): readonly Face[] {
  const { berries, grow, lobes, turn } = BUSH[look];
  return [
    ...mound([0, 0], 0.62 * grow, 1.2 * grow, 1),
    ...around(lobes, turn, (angle, index) => {
      const at = times(outward(angle), 0.5 * grow);
      return mound(
        [at[0], at[2]],
        0.42 * grow,
        0.8 * grow,
        0.92 - index * 0.05
      );
    }),
    ...around(berries, turn + 1.2, (angle, index) => {
      const climb = (index % 3) * 0.3;
      const at = times(outward(angle), 0.5 * grow * (1 - climb * 0.75));
      return block(
        [at[0], (0.6 + climb * 0.55) * grow, at[2]],
        [0.09, 0.09, 0.09],
        HUES.red
      );
    }),
  ];
}

/** One weathered boulder on the ground at (`x`, `z`): a wide belly, a shoulder pushed to one side by `skew`, and a small flat crown, its sides in two tones and its crown pale. */
function boulder(
  [x, z]: readonly [number, number],
  [wide, deep, high]: Vec,
  skew: number,
  stone: Rgb
) {
  return tube(
    [
      { at: [x, 0, z], high: deep * 0.85, wide: wide * 0.85 },
      { at: [x, high * 0.3, z], high: deep, wide },
      {
        at: [x + skew, high * 0.72, z - skew * 0.6],
        high: deep * 0.7,
        wide: wide * 0.72,
      },
      {
        at: [x + skew * 1.3, high * 0.97, z - skew * 0.8],
        high: deep * 0.32,
        wide: wide * 0.34,
      },
    ],
    (spot) => {
      if (spot.side < 0 || spot.segment === 2) {
        return toned(stone, 1.12);
      }
      return spot.side % 2 === 0 ? stone : toned(stone, 0.86);
    },
    6
  );
}

/** Each look of a group of rocks: how tall its biggest boulder stands and which way the group is turned. */
const ROCKS = [
  { high: 1.05, turn: 0 },
  { high: 0.98, turn: 2.1 },
  { high: 1.15, turn: 4.2 },
] as const;

/** A group of rocks: a big boulder with moss on its crown and two smaller ones against it. */
function rocksOf(look: number): readonly Face[] {
  const { high, turn } = ROCKS[look];
  return turned(
    [
      ...boulder([-0.1, -0.05], [0.62, 0.5, high], 0.1, HUES.stone),
      ...lobe([0.03, high * 0.99, -0.13], [0.2, 0.05, 0.16], HUES.moss, 1, 5),
      ...boulder([0.62, 0.3], [0.36, 0.3, high * 0.5], -0.05, HUES.slate),
      ...boulder(
        [-0.55, 0.42],
        [0.28, 0.24, high * 0.36],
        0.04,
        toned(HUES.stone, 0.94)
      ),
    ],
    turn
  );
}

/** Each look of a clump of reeds: how much bigger or smaller it grows and which way it is turned. */
const REED = [
  { grow: 1, turn: 0 },
  { grow: 0.9, turn: 1.9 },
  { grow: 1.08, turn: 3.8 },
] as const;

/** A clump of water reeds: blades leaning out from one root, and three cattails standing over them on thin stalks. */
function reedOf(look: number): readonly Face[] {
  const { grow, turn } = REED[look];
  return [
    ...row(7, (index) => {
      const angle = turn + index * 2.3;
      const root = times(outward(angle), 0.06 + (index % 3) * 0.07);
      const side = times(outward(angle + Math.PI / 2), 0.035);
      const tip = add(root, [
        Math.cos(angle) * 0.25,
        (1 + (index % 4) * 0.15) * grow,
        Math.sin(angle) * 0.25,
      ]);
      return slab(
        [add(root, times(side, -1)), add(root, side), tip],
        0.012,
        REEDS[index % 2]
      );
    }),
    ...row(3, (index) => {
      const angle = turn + 1 + index * 2.1;
      const root = times(outward(angle), 0.08);
      const high = (1.2 + index * 0.12) * grow;
      const top = add(root, [
        Math.cos(angle) * 0.1,
        high,
        Math.sin(angle) * 0.1,
      ]);
      return [
        ...rod(root, top, [0.014, 0.01], REEDS[1], 3),
        ...rod(top, add(top, [0, 0.2 * grow, 0]), [0.04, 0.04], CATTAIL, 5),
      ];
    }),
  ];
}

/** Each look of a sunflower: how tall it stands and which way its head is turned. */
const SUNFLOWER = [
  { high: 1.8, turn: 0 },
  { high: 1.6, turn: 0.5 },
  { high: 1.95, turn: -0.4 },
] as const;

/** A sunflower: a stem bowing forward under a wide head of seeds ringed with petals, lifted toward the sun, and two leaves on its stem. */
function sunflowerOf(look: number): readonly Face[] {
  const { high, turn } = SUNFLOWER[look];
  const heart: Vec = [0, high - 0.25, 0.14];
  const facing = unit([0, 0.35, 1]);
  const up: Vec = [0, facing[2], -facing[1]];
  return turned(
    [
      ...tube(
        [
          { at: [0, 0, 0], high: 0.03, wide: 0.03 },
          { at: [0, high * 0.6, 0.02], high: 0.025, wide: 0.025 },
          { at: add(heart, times(facing, -0.03)), high: 0.02, wide: 0.02 },
        ],
        HUES.moss,
        4
      ),
      ...rod(
        add(heart, times(facing, -0.02)),
        add(heart, times(facing, 0.05)),
        [0.13, 0.11],
        HUES.soil,
        8
      ),
      ...around(8, 0.2, (angle) => {
        const out = add(
          times([1, 0, 0], Math.cos(angle)),
          times(up, Math.sin(angle))
        );
        const side = add(
          times([1, 0, 0], -Math.sin(angle) * 0.05),
          times(up, Math.cos(angle) * 0.05)
        );
        return slab(
          [
            add(heart, add(times(out, 0.1), times(side, -1))),
            add(heart, add(times(out, 0.1), side)),
            add(heart, times(out, 0.26)),
          ],
          0.014,
          HUES.yellow
        );
      }),
      ...leaf([0, high * 0.4, 0], [0.32, high * 0.45, 0.04], 0.08, HUES.leaf),
      ...leaf([0, high * 0.62, 0], [-0.3, high * 0.66, 0.06], 0.07, HUES.lime),
    ],
    turn
  );
}

/** A raised bed of flowers: four boards round dark soil, and a row of mixed flowers on their stems, planted in another order in each look. */
function flowerbedOf(look: number): readonly Face[] {
  return [
    ...hoop([0, 0, 0], [1, 0.5], 0.07, 0.34, [HUES.wood, HUES.walnut], 4),
    ...block([0, 0.04, 0], [1.86, 0.26, 0.86], HUES.soil),
    ...row(5, (index) => {
      const x = -0.72 + index * 0.36;
      const z = index % 2 === 0 ? -0.14 : 0.14;
      const high = 0.28 + ((index + look) % 3) * 0.08;
      return [
        ...rod([x, 0.3, z], [x, 0.3 + high, z], [0.016, 0.012], HUES.moss, 3),
        ...block(
          [x, 0.28 + high, z],
          [0.13, 0.13, 0.13],
          BLOOMS[(index + look * 2) % 5],
          -0.3
        ),
      ];
    }),
  ];
}

/** Every small wild thing and garden plant by its kind, each built in meters from its look, standing on the origin. */
export const GARDEN = {
  bush: bushOf,
  flowerbed: flowerbedOf,
  reed: reedOf,
  rocks: rocksOf,
  sunflower: sunflowerOf,
} satisfies Record<string, (look: number) => readonly Face[]>;
