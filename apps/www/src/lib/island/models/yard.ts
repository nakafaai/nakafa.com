import {
  around,
  block,
  lobe,
  row,
  toned,
  turned,
} from "@/lib/island/models/forms";
import { HUES } from "@/lib/island/models/hues";
import type { Face, Rig } from "@/lib/island/models/parts";
import { rgb, rigged, tipped } from "@/lib/island/models/parts";
import { rod, slab } from "@/lib/island/models/solids";

/** A camp fire's flames from their outer tongue to their pale heart. */
const FIRE = [rgb(0xff_7d_1f), rgb(0xff_9a_2a), rgb(0xff_c9_4a)] as const;

/** How a camp fire's flames flicker: rooted at the logs, their tips licking from side to side a few times a second (ADR 0047, D50). */
const FLICKER: Rig = {
  mode: "lean",
  phase: 0,
  pivot: 0.1,
  rate: 9,
  reach: 0.22,
  waves: 1.4,
};

/**
 * A garden lamp, 2.7 m to its finial: an iron foot and post, a collar that
 * flares under the lantern, glass that widens upward between four iron bars,
 * and a pointed cap.
 */
function lanternOf(): readonly Face[] {
  return [
    ...rod([0, 0, 0], [0, 0.16, 0], [0.17, 0.13], HUES.iron, 6),
    ...rod([0, 0.16, 0], [0, 2.1, 0], [0.06, 0.045], HUES.iron, 6),
    ...rod([0, 2.1, 0], [0, 2.2, 0], [0.05, 0.11], HUES.iron, 6),
    ...block([0, 2.2, 0], [0.32, 0.04, 0.32], HUES.iron),
    ...block([0, 2.24, 0], [0.2, 0.3, 0.2], HUES.glow, -0.25),
    ...row(4, (index) =>
      block(
        [index % 2 === 0 ? -0.14 : 0.14, 2.24, index < 2 ? 0.14 : -0.14],
        [0.03, 0.3, 0.03],
        HUES.iron
      )
    ),
    ...block([0, 2.54, 0], [0.38, 0.14, 0.38], HUES.iron, 0.8),
    ...rod([0, 2.66, 0], [0, 2.72, 0], [0.03, 0.02], HUES.iron, 4),
  ];
}

/**
 * A park bench, 1.6 m wide with its seat 0.45 m up: four seat slats and three
 * back slats a tone apart, on iron sides whose back legs rake up into the
 * backrest under an armrest.
 */
function benchOf(): readonly Face[] {
  const rake = -0.14;
  return [
    ...row(4, (index) =>
      block(
        [0, 0.41, -0.2 + index * 0.13],
        [1.6, 0.04, 0.11],
        index % 2 === 0 ? HUES.wood : HUES.oak
      )
    ),
    ...tipped(
      [
        ...row(3, (index) =>
          block(
            [0, 0.55 + index * 0.13, -0.2],
            [1.5, 0.1, 0.03],
            index % 2 === 0 ? HUES.oak : HUES.wood
          )
        ),
        ...row(2, (index) =>
          block(
            [index === 0 ? -0.72 : 0.72, 0, -0.24],
            [0.05, 0.93, 0.05],
            HUES.iron
          )
        ),
      ],
      rake,
      [0, 0, -0.24]
    ),
    ...row(2, (index) => {
      const x = index === 0 ? -0.72 : 0.72;
      return [
        ...block([x, 0, 0.2], [0.05, 0.62, 0.05], HUES.iron),
        ...block([x, 0.62, -0.05], [0.05, 0.04, 0.56], HUES.iron),
      ];
    }),
  ];
}

/** One 2 m span of picket fence: a pointed post at each end, two rails between them, and seven pointed pickets a tone apart on the rails' front. */
function fenceOf(): readonly Face[] {
  return [
    ...row(2, (index) =>
      block(
        [index === 0 ? -0.95 : 0.95, 0, 0],
        [0.1, 1.05, 0.1],
        HUES.white,
        0.4
      )
    ),
    ...row(2, (index) =>
      block(
        [0, 0.3 + index * 0.4, -0.03],
        [1.8, 0.08, 0.04],
        toned(HUES.white, 0.88)
      )
    ),
    ...row(7, (index) => {
      const x = -0.69 + index * 0.23;
      return slab(
        [
          [x - 0.05, 0.06, 0.01],
          [x + 0.05, 0.06, 0.01],
          [x + 0.05, 0.88, 0.01],
          [x, 0.97, 0.01],
          [x - 0.05, 0.88, 0.01],
        ],
        0.03,
        index % 2 === 0 ? HUES.white : toned(HUES.white, 0.93)
      );
    }),
  ];
}

/**
 * A camp fire: a ring of six stones round a bed of ash, three logs leaning
 * together over it, and three tongues of flame that flicker.
 */
function campfireOf(): readonly Face[] {
  return [
    ...around(6, 0.3, (angle, index) =>
      turned(
        block(
          [0, 0, 0.5],
          [0.27, 0.17, 0.2],
          index % 2 === 0 ? HUES.stone : HUES.slate,
          0.3
        ),
        angle
      )
    ),
    ...rod([0, 0, 0], [0, 0.03, 0], [0.38, 0.38], HUES.dark, 6),
    ...around(3, 0.8, (angle) =>
      rod(
        [Math.cos(angle) * 0.34, 0.05, Math.sin(angle) * 0.34],
        [-Math.cos(angle) * 0.1, 0.42, -Math.sin(angle) * 0.1],
        [0.06, 0.05],
        HUES.bark,
        5
      )
    ),
    ...rigged(
      [
        ...rod([0, 0.1, 0], [0, 0.75, 0], [0.16, 0], FIRE[0], 4),
        ...rod([0.1, 0.1, 0.05], [0.12, 0.52, 0.06], [0.1, 0], FIRE[1], 4),
        ...rod([-0.09, 0.1, -0.06], [-0.1, 0.46, -0.05], [0.09, 0], FIRE[2], 4),
      ],
      FLICKER
    ),
  ];
}

/** A play ball, 0.4 m across, in red and white panels, resting on the ground. */
function ballOf(): readonly Face[] {
  return lobe(
    [0, 0.2, 0],
    [0.2, 0.2, 0.2],
    (spot) => (Math.floor(spot.side / 2) % 2 === 0 ? HUES.red : HUES.white),
    3,
    8
  );
}

/** Every piece of garden furniture and every toy by its kind, each built in meters, standing on the origin with its front toward +z. */
export const YARD = {
  ball: ballOf,
  bench: benchOf,
  campfire: campfireOf,
  fence: fenceOf,
  lantern: lanternOf,
} satisfies Record<string, () => readonly Face[]>;
