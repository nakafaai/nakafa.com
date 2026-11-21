/**
 * Where the blood runs through the heart, and how fast. Dark blood, low in
 * oxygen, comes in through the venae cavae to the right atrium, crosses the
 * tricuspid valve into the right ventricle and leaves through the pulmonary
 * trunk for the lungs; bright blood, full of oxygen, comes back through the
 * four pulmonary veins to the left atrium, crosses the mitral valve into the
 * left ventricle and leaves through the aorta (OpenStax Anatomy and
 * Physiology 2e, 19.1, Figure 19.9).
 *
 * Each route has three legs: in from the veins to the atrium (`feed`),
 * through the atrioventricular valve deep into the ventricle (`fill`), and out
 * through the semilunar valve and the artery (`leave`). A drop of blood moves
 * along a leg as fast as blood crosses that leg's gate: the veins return blood
 * steadily, the inflow valve passes it only in diastole and the outflow valve
 * only in systole, so drops gather in the atrium while the ventricle
 * contracts and in the ventricle while it fills. Each leg carries one beat's
 * blood a beat, so a drop takes about a beat to cross a leg. The right
 * heart's flows follow the left's: both ventricles pump the same volume.
 */

import type { Point } from "@repo/design-system/components/contents/biology/heart/anatomy";
import {
  AORTA,
  LEFT_ATRIUM,
  MITRAL,
  PULMONARY,
  place,
  RIGHT_ATRIUM,
  TRICUSPID,
} from "@repo/design-system/components/contents/biology/heart/anatomy";
import type { Moment } from "@repo/design-system/components/contents/biology/heart/circulation";
import type { Beat } from "@repo/design-system/components/contents/biology/heart/cycle";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr } from "effect";

/** A point along a stream and the stream's radius there, in centimetres. */
const at = (point: Point, radius: number) =>
  [point[0], point[1], point[2], radius] as const;

/** The middle of each atrium, a little behind the cut so its blood shows. */
const RIGHT_POOL = place(RIGHT_ATRIUM.along, RIGHT_ATRIUM.across, -0.6);
const LEFT_POOL = place(LEFT_ATRIUM.along, LEFT_ATRIUM.across, -1.7);

/** Deep in each ventricle, where blood waits for the ventricle to contract. */
const RIGHT_DEEP = place(3.8, -2.8, -0.2);
const LEFT_DEEP = place(4.4, 1.3, -0.3);

/** The dark blood's route through the right heart to the lungs. */
const VENOUS = {
  feeds: [
    [
      at([-3.5, 7.2, -1.1], 0.6),
      at([-3.45, 4.8, -1.0], 0.6),
      at([-3.4, 2.4, -0.9], 0.7),
      at(RIGHT_POOL, 1.0),
    ],
    [
      at([-2.75, -5.2, -1.7], 0.7),
      at([-2.8, -3.6, -1.6], 0.7),
      at([-2.9, -1.2, -1.3], 0.8),
      at(RIGHT_POOL, 1.0),
    ],
  ],
  fill: [
    at(RIGHT_POOL, 1.0),
    at(place(-0.8, -2.55, -0.3), 0.9),
    at(place(TRICUSPID.along, TRICUSPID.across, -0.1), 0.9),
    at(place(2.0, -2.6, -0.1), 0.8),
    at(RIGHT_DEEP, 0.7),
  ],
  leaves: Arr.map(
    [
      [at([3.1, 5.7, -1.7], 0.6), at([5.1, 6.0, -2.4], 0.6)],
      [at([-1.0, 5.4, -2.9], 0.6), at([-3.4, 5.1, -3.3], 0.6)],
    ],
    (branch) => [
      at(RIGHT_DEEP, 0.7),
      at(place(2.4, -2.3, 0.4), 0.7),
      ...Arr.map(PULMONARY, ([x, y, z, radius]) =>
        at([x, y, Math.min(z, 1.6)], radius * 0.7)
      ),
      ...branch,
    ]
  ),
};

/** The bright blood's route through the left heart to the body. */
const ARTERIAL = {
  feeds: Arr.map(
    [
      [
        [-2.8, 3.4, -3.9],
        [-1.0, 3.3, -3.4],
        [1.4, 3.3, -2.3],
      ],
      [
        [-2.8, 1.6, -3.9],
        [-1.0, 1.8, -3.4],
        [1.4, 2.3, -2.3],
      ],
      [
        [5.7, 4.4, -3.2],
        [4.8, 4.2, -3.0],
        [3.3, 3.7, -2.4],
      ],
      [
        [5.7, 2.3, -3.3],
        [4.8, 2.4, -3.1],
        [3.3, 2.5, -2.4],
      ],
    ] as const,
    (vein) => [...Arr.map(vein, (point) => at(point, 0.4)), at(LEFT_POOL, 0.9)]
  ),
  fill: [
    at(LEFT_POOL, 0.9),
    at([2.1, 2.0, -1.0], 0.9),
    at(place(MITRAL.along, MITRAL.across, -0.4), 1.0),
    at(place(1.8, 1.6, -0.3), 1.0),
    at(LEFT_DEEP, 0.9),
  ],
  leaves: [
    [
      at(LEFT_DEEP, 0.9),
      at(place(2.6, 0.5, -0.1), 0.9),
      at([0.6, -1.6, 0.0], 0.7),
      at([-0.6, 0.0, 0.0], 0.7),
      ...Arr.map(AORTA, ([x, y, z, radius]) =>
        at([x, y, Math.min(z, -0.1)], radius * 0.7)
      ),
    ],
  ],
};

/**
 * A stream prepared for walking: its points, and how far along it each lies
 * as a share of its whole length.
 */
function prepare(
  points: readonly (readonly [number, number, number, number])[]
) {
  const steps = Arr.map(Arr.zip(points, Arr.drop(points, 1)), ([from, to]) =>
    Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])
  );
  const total = Arr.reduce(steps, 0, (sum, step) => sum + step);
  const shares = Arr.scan(steps, 0, (sum, step) => sum + step / total);
  return { points, shares };
}
type Stream = ReturnType<typeof prepare>;

/** Both routes, their streams prepared. */
export const ROUTES = {
  arterial: {
    feeds: Arr.map(ARTERIAL.feeds, prepare),
    fill: prepare(ARTERIAL.fill),
    leaves: Arr.map(ARTERIAL.leaves, prepare),
  },
  venous: {
    feeds: Arr.map(VENOUS.feeds, prepare),
    fill: prepare(VENOUS.fill),
    leaves: Arr.map(VENOUS.leaves, prepare),
  },
};
type Route = (typeof ROUTES)[keyof typeof ROUTES];

/** How many legs a route has: feed, fill and leave. */
export const LEGS = 3;

/** How far from the middle of its stream a drop runs, at most, as a share of the stream's radius. */
const REACH = 0.8;

/**
 * The lane of drop `index` on a route: its angle round the stream and its
 * distance from the middle as a share of the radius, scattered evenly over
 * the stream's section; its speed, faster in the middle and slower by the
 * wall as in the parabolic flow of a vessel (mean 1); and which vein feeds it
 * and which artery takes it away.
 */
export function laneOf(index: number, route: Route) {
  const reach = REACH * Math.sqrt(hashUnit(index, 17));
  const mean = REACH ** 2 / 2;
  return {
    angle: 2 * Math.PI * hashUnit(index, 3),
    feed: index % route.feeds.length,
    leave: Math.floor(index / route.feeds.length) % route.leaves.length,
    reach,
    speed: (1 - reach ** 2) / (1 - mean),
  };
}
type Lane = ReturnType<typeof laneOf>;

/**
 * How much blood each valve passes forward in one beat, in millilitres. It
 * is a little less than the stroke volume: part of the ventricle's swing in
 * volume is blood flowing back through a valve as its leaflets shut (the
 * closing volume), which no drop is drawn for.
 */
export function forwardFlow(beat: Beat) {
  const step = beat.period / beat.moments.length;
  return {
    inflow: Arr.reduce(
      beat.moments,
      0,
      (sum, moment) => sum + Math.max(0, moment.inflow) * step
    ),
    outflow: Arr.reduce(
      beat.moments,
      0,
      (sum, moment) => sum + Math.max(0, moment.outflow) * step
    ),
  };
}

/**
 * How fast blood crosses each leg at a moment, in legs a second: the veins
 * return blood steadily, the inflow valve passes the model's inflow and the
 * outflow valve its outflow, each as a share of what it passes forward in
 * a beat (`forward`), so every leg takes one beat to cross. A valve's brief
 * backflow as it shuts does not move a drop back.
 */
export function legRates(
  moment: Moment,
  forward: { readonly inflow: number; readonly outflow: number },
  period: number
) {
  return [
    1 / period,
    Math.max(0, moment.inflow) / forward.inflow,
    Math.max(0, moment.outflow) / forward.outflow,
  ] as const;
}

/**
 * Moves a drop at `progress` (its leg and how far along it, from 0 up to
 * `LEGS`) on by `step` seconds at its leg's rate and its own speed. It stops
 * at the end of its leg until the next leg's gate opens, and after the last
 * leg it starts again in the veins.
 */
export function advance(
  progress: number,
  speed: number,
  rates: readonly [number, number, number],
  step: number
) {
  const leg = Math.floor(progress);
  const moved = progress + Arr.getUnsafe(rates, leg) * speed * step;
  if (moved < leg + 1) {
    return moved;
  }
  return leg + 1 >= LEGS ? 0 : leg + 1;
}

/** Writes into `target` the point `share` of the way along a stream, offset across it to the drop's lane. */
function walk(stream: Stream, lane: Lane, share: number, target: number[]) {
  const { points, shares } = stream;
  // The segment the share falls in: the last whose start it has passed.
  const passed = Arr.reduce(shares, 0, (count, start) =>
    start <= share ? count + 1 : count
  );
  const index = Math.min(Math.max(0, passed - 1), points.length - 2);
  const from = Arr.getUnsafe(points, index);
  const to = Arr.getUnsafe(points, index + 1);
  const start = Arr.getUnsafe(shares, index);
  const end = Arr.getUnsafe(shares, index + 1);
  const t = Math.min(1, Math.max(0, (share - start) / (end - start)));
  const radius = from[3] + (to[3] - from[3]) * t;
  // Two directions across the stream: one in the frontal plane and one in depth.
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const flat = Math.max(Math.hypot(dx, dy), 1e-6);
  const offset = lane.reach * radius;
  const across = Math.cos(lane.angle) * offset;
  const deep = Math.sin(lane.angle) * offset * 0.6;
  target[0] = from[0] + dx * t - (dy / flat) * across;
  target[1] = from[1] + dy * t + (dx / flat) * across;
  target[2] = from[2] + (to[2] - from[2]) * t + deep;
}

/**
 * Writes into `target` where a drop on `route` in `lane` lies at `progress`:
 * along its vein, through the heart, or out along its artery.
 */
export function dropAt(
  route: Route,
  lane: Lane,
  progress: number,
  target: number[]
) {
  const leg = Math.min(LEGS - 1, Math.floor(progress));
  walk(streamOf(route, lane, leg), lane, progress - leg, target);
}

/** The stream a drop in `lane` follows on leg `leg` of its route. */
function streamOf(route: Route, lane: Lane, leg: number) {
  if (leg === 0) {
    return Arr.getUnsafe(route.feeds, lane.feed);
  }
  if (leg === 1) {
    return route.fill;
  }
  return Arr.getUnsafe(route.leaves, lane.leave);
}
