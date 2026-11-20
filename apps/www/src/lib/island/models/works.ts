import { Array as Arr } from "effect";
import {
  around,
  block,
  hoop,
  rolled,
  roof,
  row,
  toned,
  turned,
} from "@/lib/island/models/forms";
import { HUES } from "@/lib/island/models/hues";
import { doorOf, windowOf } from "@/lib/island/models/joinery";
import type { Face, Rgb, Rig } from "@/lib/island/models/parts";
import { loft, mirrored, rigged } from "@/lib/island/models/parts";
import type { Spot } from "@/lib/island/models/solids";
import { moved, outward, rod, times, tube } from "@/lib/island/models/solids";

/** How high a windmill's sails turn, in meters, and how they turn: once round in about seven seconds (ADR 0050, W2). */
const HUB = 7;
const SAILS: Rig = {
  mode: "spin",
  phase: 0,
  pivot: HUB,
  rate: 0.9,
  reach: 0,
  waves: 0,
};

/** A wall of one material whose sides step in tone, its ends a tone darker. */
function walled(color: Rgb) {
  return (spot: Spot) => {
    if (spot.side < 0) {
      return toned(color, 0.8);
    }
    return spot.side % 2 === 0 ? color : toned(color, 0.9);
  };
}

/**
 * A well: a ring of stones 1.6 m across round dark water, two posts holding a
 * tiled roof over it, a windlass between the posts with a crank at one end,
 * and a bucket hanging on its rope in the well's mouth.
 */
function wellOf(): readonly Face[] {
  return [
    ...hoop([0, 0, 0], [0.8, 0.8], 0.16, 0.8, [HUES.stone, HUES.slate], 10),
    ...rod([0, 0.3, 0], [0, 0.45, 0], [0.7, 0.7], HUES.water, 10),
    ...row(2, (index) =>
      block([index === 0 ? -0.92 : 0.92, 0, 0], [0.14, 2.3, 0.14], HUES.walnut)
    ),
    ...block([0, 2.16, 0], [2.1, 0.1, 0.12], HUES.walnut),
    ...roof([0, 2.26, 0], [2.3, 0.6, 1.5], 2.3, [
      HUES.blue,
      HUES.navy,
      HUES.dark,
    ]),
    ...rod([-0.85, 1.55, 0], [0.85, 1.55, 0], [0.07, 0.07], HUES.wood, 6),
    ...block([1.02, 1.38, 0], [0.05, 0.34, 0.05], HUES.iron),
    ...block([1.12, 1.34, 0], [0.22, 0.05, 0.05], HUES.iron),
    ...block([0.1, 0.94, 0], [0.03, 0.56, 0.03], HUES.rope),
    ...hoop(
      [0.1, 0.72, 0],
      [0.14, 0.14],
      0.03,
      0.24,
      [HUES.wood, HUES.iron],
      6
    ),
    ...rod([0.1, 0.72, 0], [0.1, 0.76, 0], [0.13, 0.13], HUES.walnut, 6),
  ];
}

/** How high a bridge's deck stands along its span, in meters: 1.2 m at the middle of its 8 m and down to the bank at either end. */
function archAt(along: number) {
  return 0.12 + 1.08 * (1 - (along / 4) ** 2);
}

/** A beam that follows a bridge's arch through `count` spans, `low` to `high` over the deck and `wide` from its middle to its side. */
function archOf(
  count: number,
  [low, high]: readonly [number, number],
  wide: number,
  color: Rgb
) {
  const section = (index: number) => {
    const along = -3.8 + (index * 7.6) / count;
    return {
      high: archAt(along) + high,
      low: Math.max(0, archAt(along) + low),
      width: wide,
      z: along,
    };
  };
  return loft(
    [section(0), ...Arr.makeBy(count, (index) => section(index + 1))],
    color
  );
}

/**
 * An arched plank bridge, 8 m long and 2 m wide, its deck 1.2 m up at mid
 * span: planks a tone apart laid over two arched stringers, five posts a side
 * and two rails that follow the arch. It runs across, so a walker crosses it
 * from left to right.
 */
function bridgeOf(): readonly Face[] {
  const side = [
    ...archOf(6, [-0.36, -0.1], 0.07, HUES.walnut),
    ...moved(archOf(4, [0.85, 0.95], 0.05, HUES.walnut), [0.12, 0, 0]),
    ...moved(archOf(4, [0.42, 0.5], 0.04, HUES.wood), [0.12, 0, 0]),
    ...row(5, (index) => {
      const along = -3.8 + index * 1.9;
      return block(
        [0.12, archAt(along) - 0.1, along],
        [0.12, 1.1, 0.12],
        HUES.walnut
      );
    }),
  ];
  return turned(
    [
      ...row(12, (index) => {
        const from = -4 + (index * 2) / 3;
        const to = from + 2 / 3;
        return loft(
          [
            { high: archAt(from), low: archAt(from) - 0.1, width: 1, z: from },
            { high: archAt(to), low: archAt(to) - 0.1, width: 1, z: to },
          ],
          index % 2 === 0 ? HUES.wood : HUES.oak
        );
      }),
      ...moved(side, [0.8, 0, 0]),
      ...mirrored(moved(side, [0.8, 0, 0])),
    ],
    Math.PI / 2
  );
}

/** One sail of a windmill, standing up from the hub: a stock, cloth laid over a lattice of bars along its trailing side. */
function sailOf(): readonly Face[] {
  return [
    ...block([0, HUB + 0.2, 2.1], [0.1, 3.8, 0.08], HUES.walnut),
    ...block([0.48, HUB + 0.9, 2.08], [0.8, 3, 0.02], HUES.white),
    ...block([0.9, HUB + 0.9, 2.1], [0.06, 3, 0.06], HUES.wood),
    ...row(3, (index) =>
      block([0.47, HUB + 1 + index * 1.4, 2.1], [0.86, 0.06, 0.05], HUES.wood)
    ),
  ];
}

/**
 * A windmill: an eight-sided tower 9 m to the tip of its cap, stone below and
 * timber boards above, a door in a stone surround and a window over it, and
 * four lattice sails 4 m long turning on an axle through its front.
 */
function windmillOf(): readonly Face[] {
  return [
    ...rod([0, 0, 0], [0, 0.3, 0], [2.4, 2.3], walled(HUES.slate), 8),
    ...tube(
      [
        { at: [0, 0.3, 0], high: 2.1, wide: 2.1 },
        { at: [0, 3.2, 0], high: 1.78, wide: 1.78 },
        { at: [0, 7.3, 0], high: 1.3, wide: 1.3 },
      ],
      (spot) => walled(spot.segment === 0 ? HUES.stone : HUES.cream)(spot),
      8
    ),
    ...tube(
      [
        { at: [0, 7.3, 0], high: 1.5, wide: 1.5 },
        { at: [0, 7.9, 0], high: 1.3, wide: 1.3 },
        { at: [0, 9, 0], high: 0, wide: 0 },
      ],
      walled(HUES.red),
      8
    ),
    ...block([0, 0.3, 1.62], [1.5, 2.3, 0.8], HUES.slate),
    ...doorOf([0, 0.3, 2.04], 1),
    ...windowOf([0, 4.9, 1.48], [0.6, 0.8]),
    ...rod([0, HUB, 1], [0, HUB, 2], [0.14, 0.14], HUES.walnut, 6),
    ...rigged(
      [
        ...rod([0, HUB, 1.95], [0, HUB, 2.2], [0.26, 0.2], HUES.iron, 8),
        ...row(4, (index) =>
          rolled(sailOf(), 0.35 + (index * Math.PI) / 2, [0, HUB, 0])
        ),
      ],
      SAILS
    ),
  ];
}

/**
 * A lighthouse, 14 m to the top of its finial: a stone base, a tapering tower
 * in white and red bands, a gallery with a rail round the lantern room, glass
 * panes round the lamp, and a red cap. Its door stands in a stone porch and a
 * window lights the stair on two sides.
 */
function lighthouseOf(): readonly Face[] {
  return [
    ...rod([0, 0, 0], [0, 0.8, 0], [2.5, 2.4], walled(HUES.slate), 8),
    ...tube(
      [
        { at: [0, 0.8, 0], high: 2.05, wide: 2.05 },
        { at: [0, 2.8, 0], high: 1.92, wide: 1.92 },
        { at: [0, 4.8, 0], high: 1.79, wide: 1.79 },
        { at: [0, 6.8, 0], high: 1.66, wide: 1.66 },
        { at: [0, 8.8, 0], high: 1.53, wide: 1.53 },
        { at: [0, 10.8, 0], high: 1.4, wide: 1.4 },
      ],
      (spot) => walled(spot.segment % 2 === 0 ? HUES.white : HUES.red)(spot),
      8
    ),
    ...tube(
      [
        { at: [0, 10.5, 0], high: 1.42, wide: 1.42 },
        { at: [0, 10.8, 0], high: 1.95, wide: 1.95 },
      ],
      HUES.iron,
      8
    ),
    ...rod([0, 10.8, 0], [0, 10.95, 0], [1.95, 1.95], HUES.slate, 8),
    ...hoop([0, 11.85, 0], [1.72, 1.72], 0.07, 0.07, [HUES.iron, HUES.iron], 8),
    ...around(8, 0, (angle) => {
      const at = times(outward(angle), 1.685);
      return rod(
        [at[0], 10.95, at[2]],
        [at[0], 11.85, at[2]],
        [0.03, 0.03],
        HUES.iron,
        3
      );
    }),
    ...rod([0, 10.95, 0], [0, 11.2, 0], [1.05, 1.05], HUES.iron, 8),
    ...rod(
      [0, 11.2, 0],
      [0, 12.5, 0],
      [0.95, 0.95],
      (spot) => (spot.side % 2 === 0 ? HUES.glow : HUES.glass),
      8
    ),
    ...tube(
      [
        { at: [0, 12.5, 0], high: 1.3, wide: 1.3 },
        { at: [0, 12.75, 0], high: 1.15, wide: 1.15 },
        { at: [0, 13.6, 0], high: 0, wide: 0 },
      ],
      walled(HUES.brick),
      8
    ),
    ...rod([0, 13.5, 0], [0, 14, 0], [0.07, 0.03], HUES.iron, 4),
    ...block([0, 0, 2], [1.5, 2.3, 0.9], HUES.stone),
    ...doorOf([0, 0, 2.47], 1),
    ...windowOf([0, 5, 1.66], [0.5, 0.8]),
    ...turned(windowOf([0, 8.4, 1.45], [0.5, 0.8]), Math.PI / 2),
  ];
}

/** Every work of stone and timber by its kind, each built in meters, standing on the origin with its front toward +z. */
export const WORKS = {
  bridge: bridgeOf,
  lighthouse: lighthouseOf,
  well: wellOf,
  windmill: windmillOf,
} satisfies Record<string, () => readonly Face[]>;
