import { Array as Arr, Schema } from "effect";
import {
  type Face,
  meters as m,
  type Rig,
  rigged,
  type Vec,
} from "@/lib/island/models/parts";
import {
  add,
  ball,
  outward,
  rod,
  slab,
  times,
  tint,
  tube,
  unit,
} from "@/lib/island/models/solids";
import { kelpOf, lilyOf, seagrassOf } from "@/lib/island/models/weeds";
import { unitOf } from "@/lib/island/noise";
import type { Ramp, Tone } from "@/lib/island/palette";

/**
 * Every kind of life rooted on the sea floor or floating on a pond (ADR 0047,
 * D50): hard corals in their three main forms (branching staghorn, a flat
 * table on a stem, a domed brain coral), a sea fan, a barrel sponge, a kelp
 * stand, a tuft of seagrass, a carpet anemone, and a lily pad on still water.
 */
export const ReefKind = Schema.Literals([
  "branching",
  "table",
  "brain",
  "fan",
  "sponge",
  "kelp",
  "seagrass",
  "anemone",
  "lily",
]);
export type ReefKind = typeof ReefKind.Type;

/** How many looks each kind comes in, each its own color and its own shape, so no two neighbours repeat. */
export const LOOKS = 3;

/** The palette ramp of each look of each kind, as the real colonies color: staghorn tan, pink or purple; brain coral olive, ochre or green. */
const RAMPS: Record<ReefKind, readonly [Ramp, Ramp, Ramp]> = {
  anemone: ["pink", "violet", "teal"],
  brain: ["olive", "sun", "lime"],
  branching: ["tan", "pink", "violet"],
  fan: ["violet", "coral", "sun"],
  kelp: ["olive", "tan", "olive"],
  lily: ["leaf", "grass", "leaf"],
  seagrass: ["grass", "lime", "leaf"],
  sponge: ["violet", "rust", "ash"],
  table: ["teal", "tan", "lime"],
};

/** How a sea fan and an anemone's tentacles sway in the current (D50). */
const SWAYS = {
  anemone: {
    mode: "lean",
    phase: 0,
    pivot: 0,
    rate: 2.4,
    reach: 0.6,
    waves: 3,
  },
  fan: { mode: "lean", phase: 0, pivot: 0, rate: 1.3, reach: 0.12, waves: 0.3 },
} satisfies Record<string, Rig>;

/** Each depth of a branching coral's fork, from its tips (0) to its trunk, by tone: the growing tips palest, as a staghorn's are. */
const BRANCH_TONES: readonly Tone[] = [3, 2, 1, 1];

/**
 * One limb of a branching coral and everything that forks from it: each fork
 * shorter and thinner than its parent and turned up and out, as a staghorn
 * colony grows toward the light.
 */
function branchOf(
  from: Vec,
  toward: Vec,
  length: number,
  depth: number,
  ramp: Ramp,
  seed: number
): readonly Face[] {
  const to = add(from, times(toward, length));
  const thick = m(0.016) * (1 + depth * 0.45);
  const limb = rod(
    from,
    to,
    [thick, depth === 0 ? thick * 0.55 : thick * 0.8],
    tint(ramp, BRANCH_TONES[depth]),
    4
  );
  if (depth === 0) {
    return limb;
  }
  const forks = depth === 3 && unitOf(seed, depth, 9) < 0.5 ? 3 : 2;
  const start = unitOf(seed, depth, 7) * Math.PI * 2;
  const children = Arr.flatMap(
    Arr.makeBy(forks, (fork) => fork),
    (fork) => {
      const angle = start + (fork / forks) * Math.PI * 2;
      const tilt = 0.4 + unitOf(seed, depth, fork) * 0.35;
      const out = outward(angle);
      const bent = unit([
        toward[0] * Math.cos(tilt) + out[0] * Math.sin(tilt),
        Math.max(0.45, toward[1] * Math.cos(tilt)),
        toward[2] * Math.cos(tilt) + out[2] * Math.sin(tilt),
      ]);
      return branchOf(
        to,
        bent,
        length * 0.74,
        depth - 1,
        ramp,
        seed * 3 + fork
      );
    }
  );
  return [...limb, ...children];
}

/** A staghorn colony: three trunks leaning apart, each forking three times into pale-tipped branches. */
function branchingOf(ramp: Ramp, look: number) {
  return Arr.flatMap(
    Arr.makeBy(3, (trunk) => trunk),
    (trunk) => {
      const angle = (trunk / 3) * Math.PI * 2 + look;
      return branchOf(
        times(outward(angle), m(0.05)),
        unit(add([0, 1, 0], times(outward(angle), 0.45))),
        m(0.2 + look * 0.03),
        3,
        ramp,
        101 + look * 17 + trunk
      );
    }
  );
}

/** One tier of a table coral: a short stem under a wide, flat plate whose top is pale with polyps. */
function tierOf(ramp: Ramp, at: Vec, reach: number, oval: number) {
  const top = at[1];
  const stem = rod([at[0], 0, at[2]], at, [m(0.05), m(0.04)], tint(ramp, 1), 6);
  const plate = tube(
    [
      { at: [at[0], top - m(0.02), at[2]], high: m(0.05), wide: m(0.05) },
      { at: [at[0], top + m(0.03), at[2]], high: reach * oval, wide: reach },
      {
        at: [at[0], top + m(0.06), at[2]],
        high: reach * oval * 1.05,
        wide: reach * 1.05,
      },
      { at: [at[0], top + m(0.07), at[2]], high: 0, wide: 0 },
    ],
    (spot) => {
      if (spot.segment < 2) {
        return tint(ramp, 1);
      }
      return tint(ramp, spot.side % 2 === 0 ? 3 : 2);
    },
    10
  );
  return [...stem, ...plate];
}

/** A table coral: one plate, a plate with a smaller one beside it, or one long oval plate. */
function tableOf(ramp: Ramp, look: number) {
  if (look === 1) {
    return [
      ...tierOf(ramp, [0, m(0.3), 0], m(0.42), 1),
      ...tierOf(ramp, [m(0.32), m(0.18), m(0.2)], m(0.26), 0.9),
    ];
  }
  return tierOf(
    ramp,
    [0, m(0.32), 0],
    m(look === 2 ? 0.6 : 0.5),
    look === 2 ? 0.6 : 0.85
  );
}

/** A brain coral: a dome half sunk in the sand, its grooves in darker bands and its crown catching the light. */
function brainOf(ramp: Ramp, look: number) {
  const size = [1, 0.75, 1.3][look];
  const stretch = [1, 1.35, 1][look];
  return ball(
    [0, m(0.06), 0],
    [m(0.3) * size, m(0.24) * size, m(0.3) * size * stretch],
    (spot) => {
      if (spot.segment % 2 === 0) {
        return tint(ramp, 1);
      }
      return tint(ramp, spot.up > 0.5 ? 3 : 2);
    },
    5,
    10
  );
}

/**
 * A sea fan: a flat net on a short stem, square to the current as a real
 * gorgonian grows, its branches standing out from the net in a paler tone.
 */
function fanOf(ramp: Ramp, look: number) {
  const reach = m([0.55, 0.42, 0.7][look]);
  const lift = [1.15, 1.45, 0.95][look];
  const stalk: Vec = [0, m(0.14), 0];
  const rim = Arr.makeBy(9, (index): Vec => {
    const angle = 0.3 + (index / 8) * (Math.PI - 0.6);
    return [
      Math.cos(angle) * reach,
      stalk[1] + Math.sin(angle) * reach * lift,
      0,
    ];
  });
  const net = slab(
    [
      [m(0.03), stalk[1] - m(0.02), 0],
      ...Arr.reverse(rim),
      [-m(0.03), stalk[1] - m(0.02), 0],
    ],
    m(0.012),
    tint(ramp, 1)
  );
  const branches = Arr.flatMap(rim, (point, index) =>
    index % 2 === 0
      ? rod(stalk, point, [m(0.016), m(0.008)], tint(ramp, 3), 4)
      : []
  );
  const stem = rod([0, 0, 0], stalk, [m(0.03), m(0.022)], tint(ramp, 2), 4);
  return rigged([...stem, ...net, ...branches], SWAYS.fan);
}

/** A sponge's wall in ridges, its opening dark. */
function spongeWall(ramp: Ramp) {
  return (spot: { side: number; segment: number }) => {
    if (spot.side < 0) {
      return tint(ramp, 0);
    }
    return tint(ramp, spot.segment % 2 === 0 ? 1 : 2);
  };
}

/** A barrel sponge, a cluster of tube sponges, or a vase sponge flaring to its rim. */
function spongeOf(ramp: Ramp, look: number) {
  if (look === 1) {
    return Arr.flatMap(
      Arr.makeBy(3, (tube) => tube),
      (index) => {
        const foot = times(outward(index * 2.1), m(0.07));
        const height = m(0.38 + index * 0.12);
        return tube(
          [
            { at: foot, high: m(0.05), wide: m(0.05) },
            { at: [foot[0], height, foot[2]], high: m(0.06), wide: m(0.06) },
          ],
          spongeWall(ramp),
          6
        );
      }
    );
  }
  const flare = look === 2 ? 1.5 : 1;
  return tube(
    [
      { at: [0, 0, 0], high: m(0.16), wide: m(0.16) },
      { at: [0, m(0.18), 0], high: m(0.25), wide: m(0.25) },
      { at: [0, m(0.42), 0], high: m(0.29) * flare, wide: m(0.29) * flare },
      { at: [0, m(0.56), 0], high: m(0.27) * flare, wide: m(0.27) * flare },
    ],
    spongeWall(ramp),
    8
  );
}

/** A carpet anemone: a short column under a wide oral disc ringed with tentacles that sway, their tips pale. */
function anemoneOf(ramp: Ramp, look: number) {
  const reach = m([0.24, 0.18, 0.32][look]);
  const top = m(0.1);
  const column = tube(
    [
      { at: [0, 0, 0], high: reach * 0.6, wide: reach * 0.6 },
      { at: [0, top, 0], high: reach, wide: reach },
    ],
    (spot) => tint(ramp, spot.side < 0 ? 2 : 0),
    10
  );
  const count = 18;
  const tentacles = Arr.flatMap(
    Arr.makeBy(count, (index) => index),
    (index) => {
      const angle = (index / count) * Math.PI * 2;
      const ring = index % 2 === 0 ? 1 : 0.6;
      const foot = add(times(outward(angle), reach * ring), [0, top, 0]);
      const tip = add(
        foot,
        add(times(outward(angle), m(0.07)), [0, m(0.09), 0])
      );
      return rod(foot, tip, [m(0.018), 0], tint(ramp, 3), 4);
    }
  );
  return [...column, ...rigged(tentacles, { ...SWAYS.anemone, pivot: top })];
}

/** How each kind is built from its ramp and its look. */
const BUILDERS: Record<
  ReefKind,
  (ramp: Ramp, look: number) => readonly Face[]
> = {
  anemone: anemoneOf,
  branching: branchingOf,
  brain: brainOf,
  fan: fanOf,
  kelp: kelpOf,
  lily: lilyOf,
  seagrass: seagrassOf,
  sponge: spongeOf,
  table: tableOf,
};

/** The faces of one look of one kind of reef life, standing on the floor at the origin. */
export function reefFaces(kind: ReefKind, look: number): readonly Face[] {
  return BUILDERS[kind](RAMPS[kind][look], look);
}
