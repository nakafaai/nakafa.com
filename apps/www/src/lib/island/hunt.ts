import { SPAN } from "@repo/backend/confect/island/world";
import { unitOf } from "@/lib/island/noise";
import { SEA_LEVEL } from "@/lib/island/world";

/**
 * The bait ball (ADR 0047, D50): a school of mackerel milling round its own
 * middle, which drifts on a slow round `lane` cells from the island's middle,
 * between the whale's round and the dolphins', `depth` blocks down.
 */
const BALL = { depth: 2, lane: 52.5, speed: 0.5 } as const;

/**
 * How the reef shark hunts the bait ball, in seconds and cells: it circles
 * the ball `radius` cells out at `speed` cells a second for `circle`
 * seconds, then charges straight through its middle in `charge` seconds,
 * and the school bursts apart to either side of its line and closes again
 * over `scatter` seconds, as sharks herd and split a real bait ball.
 */
const HUNT = {
  charge: 1.2,
  circle: 14,
  radius: 2.4,
  scatter: 4,
  speed: 2.6,
} as const;

/** One whole round of the hunt: circling, then the charge. */
const CYCLE = HUNT.circle + HUNT.charge;

/** How fast the shark turns round the ball, in radians a second. */
const TURN = HUNT.speed / HUNT.radius;

/** Where the bait ball's middle is at `time` seconds. */
export function ballAt(seed: number, time: number) {
  const angle =
    unitOf(seed + 32, 0, 0, 0) * Math.PI * 2 + (time * BALL.speed) / BALL.lane;
  return {
    x: SPAN / 2 + Math.cos(angle) * BALL.lane,
    y: SEA_LEVEL - BALL.depth,
    z: SPAN / 2 + Math.sin(angle) * BALL.lane,
  };
}

/** Which round of the hunt `time` falls in, and how far into it. */
function roundOf(time: number) {
  const round = Math.floor(time / CYCLE);
  return { round, within: time - round * CYCLE };
}

/** Where round `round`'s charge starts on the circle: each charge leaves the shark on the far side, half a turn on. */
function chargeAngle(seed: number, round: number) {
  return (
    unitOf(seed + 33, 0, 0, 0) * Math.PI * 2 +
    (round + 1) * HUNT.circle * TURN +
    round * Math.PI
  );
}

/**
 * Where the reef shark is at `time` and which way it faces: circling the
 * ball, or charging straight across it from one side of its circle to the
 * other.
 */
export function hunterAt(seed: number, time: number) {
  const ball = ballAt(seed, time);
  const { round, within } = roundOf(time);
  if (within >= HUNT.circle) {
    const from = chargeAngle(seed, round);
    const share = 1 - (2 * (within - HUNT.circle)) / HUNT.charge;
    return {
      x: ball.x + Math.cos(from) * HUNT.radius * share,
      y: ball.y,
      yaw: Math.atan2(-Math.cos(from), -Math.sin(from)),
      z: ball.z + Math.sin(from) * HUNT.radius * share,
    };
  }
  const angle = chargeAngle(seed, round) - (HUNT.circle - within) * TURN;
  return {
    x: ball.x + Math.cos(angle) * HUNT.radius,
    y: ball.y,
    yaw: Math.atan2(-Math.sin(angle), Math.cos(angle)),
    z: ball.z + Math.sin(angle) * HUNT.radius,
  };
}

/**
 * How far the bait ball is thrown apart at `time`, from 0 to 1, and the way
 * across the shark's latest charge, as x and z, so each fish flees to its own
 * side of the shark's line. Before the first charge it lies still.
 */
export function scatterAt(seed: number, time: number) {
  const { round, within } = roundOf(time);
  const charged = within >= HUNT.circle ? round : round - 1;
  const since =
    within >= HUNT.circle ? within - HUNT.circle : within + HUNT.charge;
  const from = chargeAngle(seed, charged);
  return {
    across: { x: -Math.sin(from), z: Math.cos(from) },
    burst:
      charged >= 0 && since < HUNT.scatter
        ? Math.sin((Math.PI * since) / HUNT.scatter)
        : 0,
  };
}
