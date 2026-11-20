import { Option, Schema } from "effect";
import type { Standing } from "@/lib/island/collide";
import { clearOf, deckAt, groundAt } from "@/lib/island/collide";
import type { Land } from "@/lib/island/land/ground";
import { depthAt, flowAt } from "@/lib/island/land/ground";
import type { Footing } from "@/lib/island/steps";
import { footingAt } from "@/lib/island/steps";

/**
 * The learner's fox as a body with weight (ADR 0047, D12 and D22; ADR 0050,
 * W1): where its feet are, in blocks, the way it faces, how fast it moves
 * over the ground and up or down, whether it is in the air or swims, how far
 * into its stride it is, from 0 to 1, and the phase of its bob in water.
 */
export const Walker = Schema.Struct({
  airborne: Schema.Boolean,
  bob: Schema.Finite,
  rise: Schema.Finite,
  speedX: Schema.Finite,
  speedZ: Schema.Finite,
  stride: Schema.Finite,
  swims: Schema.Boolean,
  x: Schema.Finite,
  y: Schema.Finite,
  yaw: Schema.Finite,
  z: Schema.Finite,
});
export type Walker = typeof Walker.Type;

/** Where a walker is asked to go: a direction over the ground of length one, or none, and the speed it wants, in blocks a second. */
export const Drive = Schema.Struct({
  speed: Schema.Finite,
  x: Schema.Finite,
  z: Schema.Finite,
});
export type Drive = typeof Drive.Type;

/** How fast the fox moves, in blocks a second: a brisk walk of 3 m/s, a run of 5 m/s, and a paddle of 1.7 m/s. */
export const PACE = { run: 5.6, swim: 1.9, walk: 3.4 } as const;

/** How fast the fox gains speed on the ground, in blocks a second squared: it reaches its walk in a third of a second. */
const PUSH = 10.5;

/** How fast the ground takes the fox's speed when nothing is held, in blocks a second squared: a walk stops in a quarter of a second, a run in under half. */
const FRICTION = 13;

/** How fast the fox changes its speed in the air, in blocks a second squared: a jump keeps most of the speed it left the ground with. */
const AIR = 3;

/** How fast the fox turns to face the way it moves, in radians a second: about face in a third of a second. */
const TURN = 9;

/** The steepest ground the fox climbs: a rise of 1.1 blocks over one block, about 48 degrees. */
export const CLIMB = 1.1;

/** The steepest ground the fox walks down: a fall of 2.2 blocks over one block, about 66 degrees; anything steeper is a cliff. */
export const DROP = 2.2;

/** How deep water stands before the fox swims in it, in blocks: 45 cm, its belly. */
export const SWIM = 0.5;

/** How fast a river carries a swimmer along, in blocks a second: gently, a third of its paddle. */
const DRIFT = 0.65;

/** The speed the fox leaves the ground with when it jumps, in blocks a second, which lifts it about 0.7 blocks. */
const JUMP = 4.2;

/** How fast a jump is pulled back down, in blocks a second squared: a little over the 10.9 of real gravity, so a hop is quick. */
const GRAVITY = 13;

/** Half the fox's width, in blocks: it is 0.63 m across the shoulders. */
export const BODY = 0.35;

/** How far the fox moves between two footsteps, in blocks: a trot, a longer bound when it runs, a stroke when it swims (ADR 0047, D40). */
const STRIDE = { run: 0.62, swim: 0.9, walk: 0.45 } as const;

/** How a swimmer bobs at the water's face: how far up and down, in blocks, and how fast, in radians a second. */
const BOB = { rate: 3.2, reach: 0.04 } as const;

/** How far to either side the ground is read to find which way it rises, in blocks. */
const PROBE = 0.3;

/** How far ahead the ground is read for the hill the fox is about to climb, in blocks. */
const AHEAD = 0.7;

/** How much a hill slows or speeds the fox: its share of speed lost for each block of rise over a block, and the least and the most of its pace it keeps. */
const HILL = { least: 0.5, most: 1.18, weight: 0.85 } as const;

/** A drive that asks for nothing. */
export const REST: Drive = { speed: 0, x: 0, z: 0 };

/** A fox standing still at a place of the land, facing `yaw`. */
export function walkerAt(land: Land, x: number, z: number, yaw = 0): Walker {
  return {
    airborne: false,
    bob: 0,
    rise: 0,
    speedX: 0,
    speedZ: 0,
    stride: 0,
    swims: depthAt(land, x, z) > SWIM,
    x,
    y: groundAt(land, [], x, z),
    yaw,
    z,
  };
}

/** The fox leaving the ground in a jump; one in the air or in the water stays as it is. */
export function jumped(walker: Walker): Walker {
  return walker.airborne || walker.swims
    ? walker
    : { ...walker, airborne: true, rise: JUMP };
}

/** A speed over the ground moved toward a wanted one by at most `most`, so a body never starts, stops or turns its motion at once. */
function eased(
  from: readonly [number, number],
  to: readonly [number, number],
  most: number
) {
  const [dx, dz] = [to[0] - from[0], to[1] - from[1]];
  const gap = Math.hypot(dx, dz);
  return gap <= most
    ? to
    : ([from[0] + (dx / gap) * most, from[1] + (dz / gap) * most] as const);
}

/** The speed over the ground a drive asks of a walker: its pace, slower up a hill and a little quicker down one, and no more than a paddle in water. */
function wantedOf(
  ground: (x: number, z: number) => number,
  walker: Walker,
  drive: Drive
) {
  if (drive.speed <= 0) {
    return [0, 0] as const;
  }
  if (walker.swims) {
    const paddle = Math.min(drive.speed, PACE.swim);
    return [drive.x * paddle, drive.z * paddle] as const;
  }
  const rise =
    (ground(walker.x + drive.x * AHEAD, walker.z + drive.z * AHEAD) -
      ground(walker.x, walker.z)) /
    AHEAD;
  const pace =
    drive.speed *
    Math.min(HILL.most, Math.max(HILL.least, 1 - rise * HILL.weight));
  return [drive.x * pace, drive.z * pace] as const;
}

/** Which way the ground rises at a place and how steeply: its rise over one block along x and along z, read a short way to either side. */
export function gradientOf(
  ground: (x: number, z: number) => number,
  x: number,
  z: number
) {
  return [
    (ground(x + PROBE, z) - ground(x - PROBE, z)) / (PROBE * 2),
    (ground(x, z + PROBE) - ground(x, z - PROBE)) / (PROBE * 2),
  ] as const;
}

/**
 * A step over the ground with what the ground refuses taken out of it (ADR
 * 0047, D22): onto ground too steep to climb, or over a cliff too steep to
 * walk down, the part of the step that goes up or down the slope is dropped
 * and the rest follows the slope's own line, so the fox slides along a wall
 * instead of sticking to it, and never gains height on it.
 */
function slid(
  ground: (x: number, z: number) => number,
  from: readonly [number, number],
  step: readonly [number, number]
) {
  const [across, deep] = gradientOf(
    ground,
    from[0] + step[0],
    from[1] + step[1]
  );
  const slope = Math.hypot(across, deep);
  if (slope <= CLIMB) {
    return step;
  }
  const uphill = (step[0] * across + step[1] * deep) / slope;
  if (uphill <= 0 && slope <= DROP) {
    return step;
  }
  const along = [
    step[0] - (uphill * across) / slope,
    step[1] - (uphill * deep) / slope,
  ] as const;
  // What a curved wall still lifts the step by is taken back down the slope, so the fox keeps to the height it stands at.
  const gained =
    ground(from[0] + along[0], from[1] + along[1]) - ground(from[0], from[1]);
  const back = Math.max(0, gained) / slope;
  return [
    along[0] - (back * across) / slope,
    along[1] - (back * deep) / slope,
  ] as const;
}

/** The way a walker faces, turned toward the way it moves by no more than its turning speed allows. */
function facing(
  yaw: number,
  speed: readonly [number, number],
  seconds: number
) {
  if (Math.hypot(speed[0], speed[1]) < 0.2) {
    return yaw;
  }
  const turn = Math.atan2(speed[0], speed[1]) - yaw;
  const short = turn - Math.round(turn / (Math.PI * 2)) * Math.PI * 2;
  const most = TURN * seconds;
  return yaw + Math.min(most, Math.max(-most, short));
}

/** A walker's height and its fall after `seconds`: on the ground it rests at `floor`, and in the air gravity brings it back down to land there. */
function settled(walker: Walker, floor: number, seconds: number) {
  if (!walker.airborne) {
    return { airborne: false, landed: false, rise: 0, y: floor };
  }
  const rise = walker.rise - GRAVITY * seconds;
  const y = walker.y + rise * seconds;
  return y > floor
    ? { airborne: true, landed: false, rise, y }
    : { airborne: false, landed: true, rise: 0, y: floor };
}

/** How fast a walker's speed over the ground may change, in blocks a second squared: little in the air, a push while it is driven, the ground's friction when it is not. */
function pullOf(walker: Walker, drive: Drive) {
  if (walker.airborne) {
    return AIR;
  }
  return drive.speed > 0 ? PUSH : FRICTION;
}

/** How far into its stride a walker is after moving `distance` blocks at a speed, and whether a foot came down on the way. */
function stridden(
  walker: Walker,
  distance: number,
  speed: number,
  swims: boolean
) {
  const fast = speed > (PACE.walk + PACE.run) / 2 ? STRIDE.run : STRIDE.walk;
  const stride = walker.stride + distance / (swims ? STRIDE.swim : fast);
  return { stepped: stride >= 1, stride: stride % 1 };
}

/**
 * A walker after `seconds` of a drive (ADR 0047, D12, D22 and D40; ADR 0050,
 * W1). Its speed eases toward what the drive asks, so it has weight; it turns
 * to face the way it moves; it follows the ground and the decks over it,
 * slides along ground it cannot climb and around everything that stands in
 * its way, swims where the water is deep and is carried by a river there, and
 * falls back from a jump. It answers with the footing of each footstep, one a
 * stride and one on landing, and whether the drive moved it nowhere.
 */
export function stepWalker(
  land: Land,
  walker: Walker,
  drive: Drive,
  standing: Standing,
  seconds: number
) {
  if (seconds <= 0) {
    return { blocked: false, footstep: Option.none<Footing>(), walker };
  }
  const ground = (x: number, z: number) => groundAt(land, standing.decks, x, z);
  const driven = eased(
    [walker.speedX, walker.speedZ],
    wantedOf(ground, walker, drive),
    pullOf(walker, drive) * seconds
  );
  const flow = walker.swims ? flowAt(land, walker.x, walker.z) : [0, 0];
  const carried = [flow[0] * DRIFT * seconds, flow[1] * DRIFT * seconds];
  const asked = [
    driven[0] * seconds + carried[0],
    driven[1] * seconds + carried[1],
  ] as const;
  const held = slid(ground, [walker.x, walker.z], asked);
  const [x, z] = clearOf(
    standing.blockers,
    walker.x + held[0],
    walker.z + held[1],
    BODY
  );
  const moved = [x - walker.x, z - walker.z] as const;
  // The speed it keeps is the speed it truly moved with, and never more than it drove with, so a wall takes its speed and nothing adds to it.
  const own = [
    (moved[0] - carried[0]) / seconds,
    (moved[1] - carried[1]) / seconds,
  ] as const;
  const most = Math.hypot(driven[0], driven[1]);
  const kept = Math.min(1, most / Math.max(Math.hypot(own[0], own[1]), 1e-9));
  const onDeck = Option.isSome(deckAt(standing.decks, x, z));
  const swims = !onDeck && depthAt(land, x, z) > SWIM;
  const bob = swims ? walker.bob + BOB.rate * seconds : 0;
  const fall = settled(
    walker,
    ground(x, z) + (swims ? Math.sin(bob) * BOB.reach : 0),
    seconds
  );
  const walked = stridden(walker, Math.hypot(moved[0], moved[1]), most, swims);
  const treads = fall.landed || (walked.stepped && !fall.airborne);
  const footing: Footing = onDeck ? "wood" : footingAt(land, x, z);
  return {
    blocked:
      drive.speed > 0 &&
      Math.hypot(moved[0], moved[1]) < Math.hypot(asked[0], asked[1]) * 0.05,
    footstep: treads ? Option.some(footing) : Option.none<Footing>(),
    walker: {
      airborne: fall.airborne,
      bob,
      rise: fall.rise,
      speedX: own[0] * kept,
      speedZ: own[1] * kept,
      stride: walked.stride,
      swims,
      x,
      y: fall.y,
      yaw: facing(walker.yaw, driven, seconds),
      z,
    },
  };
}
