import { Array as Arr } from "effect";
import type { Face, Rig, Vec } from "@/lib/island/models/parts";
import { meters as m, rigged } from "@/lib/island/models/parts";
import {
  add,
  ball,
  outward,
  rod,
  slab,
  times,
  tint,
} from "@/lib/island/models/solids";
import { unitOf } from "@/lib/island/noise";
import type { Ramp, Tone } from "@/lib/island/palette";

/** How the water weeds move (ADR 0047, D50): kelp slow and wide in the current, seagrass quick and short, a lily pad bobbing on the water. */
const SWAYS = {
  kelp: {
    mode: "lean",
    phase: 0,
    pivot: 0,
    rate: 1.1,
    reach: 0.07,
    waves: 0.14,
  },
  lily: {
    mode: "heave",
    phase: 0,
    pivot: 0,
    rate: 1.7,
    reach: 0.12,
    waves: 0.5,
  },
  seagrass: {
    mode: "lean",
    phase: 0,
    pivot: 0,
    rate: 1.8,
    reach: 0.3,
    waves: 0.8,
  },
} satisfies Record<string, Rig>;

/**
 * One kelp stipe: a thin stalk bowing up from the floor in segments, a long
 * narrow blade at every joint on alternating sides, each blade with a gas
 * float at its base that holds it up toward the light.
 */
function stipeOf(ramp: Ramp, height: number, angle: number, bow: number) {
  const segments = 7;
  const lean = outward(angle);
  const side = outward(angle + Math.PI / 2);
  const joints = Arr.makeBy(segments + 1, (index): Vec => {
    const share = index / segments;
    return add(times(lean, bow * share * share), [0, height * share, 0]);
  });
  const stalk = Arr.flatMap(
    Arr.makeBy(segments, (index) => index),
    (index) =>
      rod(joints[index], joints[index + 1], [0.035, 0.03], tint(ramp, 1), 4)
  );
  const blades = Arr.flatMap(
    Arr.makeBy(segments - 1, (index) => index + 1),
    (index) => {
      const base = joints[index];
      const toward = times(side, index % 2 === 0 ? 1 : -1);
      const at = (out: number, up: number) =>
        add(base, add(times(toward, out), [0, up, 0]));
      const float = rod(
        at(0.02, 0),
        at(0.07, 0.04),
        [0.035, 0.03],
        tint(ramp, 3),
        4
      );
      const blade = slab(
        [at(0.07, 0.04), at(0.16, 0.12), at(0.34, 0.5), at(0.12, 0.36)],
        0.01,
        tint(ramp, index % 2 === 0 ? 2 : 3)
      );
      return [...float, ...blade];
    }
  );
  return [...stalk, ...blades];
}

/** A kelp stand: a dark holdfast gripping the floor and three stipes of their own heights reaching toward the surface. */
export function kelpOf(ramp: Ramp, look: number) {
  const holdfast = ball([0, 0.04, 0], [0.16, 0.08, 0.16], tint(ramp, 0), 2, 6);
  const heights = [4.2 - look * 0.3, 3.6, 2.9 + look * 0.2];
  const stipes = Arr.flatMap(
    Arr.makeBy(3, (index) => index),
    (index) =>
      stipeOf(ramp, heights[index], look + index * 2.2, 0.35 + index * 0.1)
  );
  return rigged([...holdfast, ...stipes], SWAYS.kelp);
}

/** One blade of seagrass: a ribbon rising from its root, bending out over its upper half to a point. */
function bladeOf(
  ramp: Ramp,
  root: Vec,
  angle: number,
  height: number,
  tone: Tone
) {
  const out = outward(angle);
  const across = times(outward(angle + Math.PI / 2), m(0.012));
  const knee = add(root, add([0, height * 0.55, 0], times(out, m(0.03))));
  const tip = add(knee, add([0, height * 0.45, 0], times(out, m(0.08))));
  const color = tint(ramp, tone);
  return [
    ...slab(
      [
        add(root, times(across, -1)),
        add(root, across),
        add(knee, across),
        add(knee, times(across, -1)),
      ],
      m(0.006),
      color
    ),
    ...slab(
      [add(knee, times(across, -1)), add(knee, across), tip],
      m(0.006),
      color
    ),
  ];
}

/** A tuft of seagrass: a dozen blades of their own heights round a small patch of floor. */
export function seagrassOf(ramp: Ramp, look: number) {
  const blades = Arr.flatMap(
    Arr.makeBy(12, (index) => index),
    (index) => {
      const angle = unitOf(211 + look, index, 1) * Math.PI * 2;
      const root = times(
        outward(angle),
        m(0.18) * unitOf(211 + look, index, 2)
      );
      const height = m(0.28 + unitOf(211 + look, index, 3) * 0.3);
      const tone: Tone = index % 3 === 0 ? 3 : 2;
      return bladeOf(ramp, root, angle, height, tone);
    }
  );
  return rigged(blades, SWAYS.seagrass);
}

/** A lily pad: a round leaf notched to its stalk, its veins in alternating tones, flat on the water. */
function padOf(ramp: Ramp, at: Vec, reach: number, turn: number) {
  const spokes = 12;
  const rim = Arr.makeBy(spokes + 1, (index): Vec => {
    const angle = turn + 0.28 + (index / spokes) * (Math.PI * 2 - 0.56);
    return add(at, times(outward(angle), reach));
  });
  return Arr.makeBy(
    spokes,
    (index): Face => ({
      color: tint(ramp, index % 2 === 0 ? 2 : 3),
      corners: [at, rim[index + 1], rim[index]],
    })
  );
}

/** A water lily's flower: two rings of petals cupped up round a golden heart. */
function flowerOf(petal: Ramp) {
  const ring = (count: number, out: number, rise: number, tone: Tone) =>
    Arr.flatMap(
      Arr.makeBy(count, (index) => index),
      (index) => {
        const angle = (index / count) * Math.PI * 2 + out * 10;
        const way = outward(angle);
        const across = outward(angle + Math.PI / 2);
        const at = (along: number, side: number, up: number) =>
          add(add(times(way, along), times(across, side)), [
            0,
            up + m(0.02),
            0,
          ]);
        return slab(
          [
            at(m(0.02), 0, 0),
            at(out * 0.65, m(0.025), rise * 0.55),
            at(out, 0, rise),
            at(out * 0.65, -m(0.025), rise * 0.55),
          ],
          m(0.006),
          tint(petal, tone)
        );
      }
    );
  return [
    ...ring(8, m(0.1), m(0.06), 3),
    ...ring(6, m(0.07), m(0.08), 2),
    ...ball(
      [0, m(0.05), 0],
      [m(0.025), m(0.02), m(0.025)],
      tint("bloom", 2),
      2,
      6
    ),
  ];
}

/** Lily pads on still water: a pair of pads, or a pad holding up a pink or a white flower. */
export function lilyOf(ramp: Ramp, look: number) {
  if (look === 0) {
    return rigged(
      [
        ...padOf(ramp, [0, 0, 0], m(0.2), 0),
        ...padOf(ramp, [m(0.3), 0, m(0.12)], m(0.14), 2),
      ],
      SWAYS.lily
    );
  }
  return rigged(
    [
      ...padOf(ramp, [0, 0, 0], m(0.22), 1),
      ...flowerOf(look === 1 ? "pink" : "plaster"),
    ],
    SWAYS.lily
  );
}
