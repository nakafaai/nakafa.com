import { Array as Arr } from "effect";
import { around, lobe, toned } from "@/lib/island/models/forms";
import { HUES } from "@/lib/island/models/hues";
import type { Face, Vec } from "@/lib/island/models/parts";
import { rgb } from "@/lib/island/models/parts";
import {
  add,
  outward,
  rod,
  slab,
  times,
  tube,
} from "@/lib/island/models/solids";

/** A banana's pale stem, a young coconut and a banana flower's bud. */
const STEM = rgb(0x8a_a8_58);
const HUSK = rgb(0x6f_8f_3a);
const BUD = rgb(0x7a_3b_5c);

/** Each look of a coconut palm: the height of its trunk, how far it leans and how many fronds it holds. */
const PALM = [
  { fronds: 8, high: 8, lean: [1.5, 0.2], turn: 0.2 },
  { fronds: 7, high: 7.4, lean: [-1.1, 0.5], turn: 1.3 },
  { fronds: 8, high: 8.6, lean: [0.7, -1.2], turn: 2.4 },
] as const;

/** A coconut palm: a ringed trunk curving up out of its lean, fronds arching out and drooping from its top, and young coconuts under them. */
function palmOf(look: number): readonly Face[] {
  const { fronds, high, lean, turn } = PALM[look];
  const joint = (share: number): Vec => [
    lean[0] * share * share,
    0.3 + (high - 0.3) * share,
    lean[1] * share * share,
  ];
  const top = joint(1);
  return [
    ...tube(
      [
        { at: [0, 0, 0], high: 0.32, wide: 0.32 },
        ...Arr.makeBy(6, (index) => ({
          at: joint(index / 5),
          high: 0.22 - index * 0.016,
          wide: 0.22 - index * 0.016,
        })),
      ],
      (spot) => (spot.segment % 2 === 0 ? HUES.trunk : HUES.bark),
      5
    ),
    ...around(fronds, turn, (angle, index) => {
      const droop = (index % 3) * 0.3;
      const reach = (out: number, up: number): Vec =>
        add(top, add(times(outward(angle), out), [0, up, 0]));
      const color = index % 2 === 0 ? HUES.leaf : HUES.lime;
      return tube(
        [
          { at: reach(0.1, 0.05), high: 0.05, wide: 0.1 },
          { at: reach(1.3, 0.8 - droop * 0.4), high: 0.07, wide: 0.34 },
          { at: reach(2.4, 0.45 - droop * 0.8), high: 0.06, wide: 0.3 },
          { at: reach(3.1, -0.35 - droop), high: 0, wide: 0 },
        ],
        (spot) => (spot.up > 0.5 ? color : toned(HUES.moss, 0.9)),
        4
      );
    }),
    ...around(3, turn, (angle) =>
      lobe(
        add(top, add(times(outward(angle), 0.24), [0, -0.22, 0])),
        [0.14, 0.16, 0.14],
        HUSK,
        1,
        4
      )
    ),
  ];
}

/** Each look of a banana plant: its height and how many leaves it holds. */
const BANANA = [
  { high: 3, leaves: 6, turn: 0.4 },
  { high: 2.7, leaves: 5, turn: 1.5 },
  { high: 3.3, leaves: 7, turn: 2.6 },
] as const;

/** A banana plant: a pale stem of wrapped leaf bases, big paddle leaves standing and drooping from its top, and a bunch hanging on its stalk over a purple bud. */
function bananaOf(look: number): readonly Face[] {
  const { high, leaves, turn } = BANANA[look];
  const crown = high * 0.55;
  const long = (high - crown) / Math.cos(0.3);
  return [
    ...tube(
      [
        { at: [0, 0, 0], high: 0.2, wide: 0.2 },
        { at: [0, crown * 0.5, 0], high: 0.15, wide: 0.15 },
        { at: [0.03, crown, 0], high: 0.1, wide: 0.1 },
      ],
      (spot) => (spot.side % 2 === 0 ? STEM : toned(STEM, 0.88)),
      6
    ),
    ...around(leaves, turn, (angle, index) => {
      const tilt = 0.3 + (index % 3) * 0.42;
      const along = add(times(outward(angle), Math.sin(tilt)), [
        0,
        Math.cos(tilt),
        0,
      ]);
      const side = times(outward(angle + Math.PI / 2), 0.27);
      const at = (share: number, spread: number): Vec =>
        add(
          add([0.03, crown - 0.05, 0], times(along, long * share)),
          times(side, spread)
        );
      return slab(
        [
          at(0, 0),
          at(0.3, 0.9),
          at(0.75, 1),
          at(1, 0),
          at(0.75, -1),
          at(0.3, -0.9),
        ],
        0.03,
        index % 2 === 0 ? HUES.leaf : HUES.lime
      );
    }),
    ...rod(
      [0.05, crown - 0.1, 0.08],
      [0.28, crown - 0.5, 0.36],
      [0.03, 0.025],
      STEM,
      3
    ),
    ...lobe(
      [0.28, crown - 0.68, 0.36],
      [0.15, 0.22, 0.15],
      (spot) => (spot.side % 2 === 0 ? HUES.yellow : toned(HUES.yellow, 0.86)),
      2,
      5
    ),
    ...rod(
      [0.28, crown - 0.88, 0.36],
      [0.3, crown - 1.12, 0.38],
      [0.05, 0],
      BUD,
      4
    ),
  ];
}

/** Every tree that carries fronds or paddle leaves instead of a branching crown, by its kind, each built in meters from its look, standing on the origin. */
export const PALMS = {
  banana: bananaOf,
  palm: palmOf,
} satisfies Record<string, (look: number) => readonly Face[]>;
