import { Schema } from "effect";
import type { Orbit } from "@/lib/island/camera";
import { DISTANCE } from "@/lib/island/camera";

/**
 * The camera's rig (ADR 0050, W7): where it looks and where that is going,
 * its turn and its distance with their goals, how far the learner tilted it,
 * how far the ground made it rise, whether it follows the fox, and what a
 * drag left it moving and turning with. Every value eases toward its goal, a
 * pan keeps its momentum, and the ground never hides the view.
 */
export const Rig = Schema.Struct({
  distance: Schema.Finite,
  follow: Schema.Boolean,
  goalDistance: Schema.Finite,
  goalX: Schema.Finite,
  goalYaw: Schema.Finite,
  goalZ: Schema.Finite,
  leadX: Schema.Finite,
  leadZ: Schema.Finite,
  lift: Schema.Finite,
  speedX: Schema.Finite,
  speedYaw: Schema.Finite,
  speedZ: Schema.Finite,
  tilt: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
  yaw: Schema.Finite,
  z: Schema.Finite,
});
export type Rig = typeof Rig.Type;

/** How far the camera may wander from the fox, in blocks, before a pan stops. */
const LEASH = 100;

/** How far the learner may tilt the camera down or up from its own pitch, in radians. */
const TILT = { down: -0.42, up: 0.4 } as const;

/** The lowest and the highest the camera looks down at the ground, in radians. */
const PITCH = { high: 1.3, low: 0.2, steepest: 1.45 } as const;

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

/** The smooth step from 0 at `from` to 1 at `to`. */
function smooth(from: number, to: number, value: number) {
  const share = clamp((value - from) / (to - from), 0, 1);
  return share * share * (3 - 2 * share);
}

/** The share of the way to a goal covered in `seconds` at a rate, alike at any frame rate. */
function closing(seconds: number, rate: number) {
  return 1 - Math.exp(-seconds * rate);
}

/** A rig at rest over a place, following the fox. */
export function rigAt(x: number, y: number, z: number): Rig {
  return {
    distance: 17,
    follow: true,
    goalDistance: 17,
    goalX: x,
    goalYaw: 0.6,
    goalZ: z,
    leadX: 0,
    leadZ: 0,
    lift: 0,
    speedX: 0,
    speedYaw: 0,
    speedZ: 0,
    tilt: 0,
    x,
    y,
    yaw: 0.6,
    z,
  };
}

/** How steeply the camera looks down from a distance: lower when close, as a walker sees, higher when far, as a map shows. */
function pitchFor(rig: Rig) {
  return clamp(
    0.6 + 0.46 * smooth(4, 72, rig.distance) + rig.tilt,
    PITCH.low,
    PITCH.high
  );
}

/** How much higher the camera must look down so that no ground between it and its target hides the view. */
function riseOf(rig: Rig, top: (x: number, z: number) => number) {
  const base = pitchFor(rig);
  const [sin, cos] = [Math.sin(rig.yaw), Math.cos(rig.yaw)];
  for (let step = 0; step < 14; step += 1) {
    const pitch = base + step * 0.05;
    let clear = true;
    for (let part = 1; part <= 6; part += 1) {
      const reach = (rig.distance * part) / 6;
      const flat = Math.cos(pitch) * reach;
      const under = top(rig.x + sin * flat, rig.z + cos * flat);
      if (rig.y + 0.6 + Math.sin(pitch) * reach < under + 1 + reach * 0.03) {
        clear = false;
      }
    }
    if (clear) {
      return step * 0.05;
    }
  }
  return 14 * 0.05;
}

/**
 * The rig moved on by `seconds`: it follows the fox a little ahead of where
 * it walks, or glides on with what a pan left it and stays within reach of
 * the fox; its turn, its distance and its height over the ground `top` ease
 * to their goals; and it rises over ground that would hide the view, fast,
 * and comes back down slowly.
 */
export function stepRig(
  rig: Rig,
  seconds: number,
  fox: {
    readonly speedX: number;
    readonly speedZ: number;
    readonly x: number;
    readonly z: number;
  },
  top: (x: number, z: number) => number
): Rig {
  const lead = closing(seconds, 2.2);
  const leadX = rig.follow
    ? rig.leadX + (fox.speedX * 0.5 - rig.leadX) * lead
    : rig.leadX;
  const leadZ = rig.follow
    ? rig.leadZ + (fox.speedZ * 0.5 - rig.leadZ) * lead
    : rig.leadZ;
  const fade = Math.exp(-seconds * 4.2);
  const glidedX = rig.goalX + rig.speedX * seconds;
  const glidedZ = rig.goalZ + rig.speedZ * seconds;
  const away = Math.hypot(glidedX - fox.x, glidedZ - fox.z);
  const held = away > LEASH ? LEASH / away : 1;
  const goalX = rig.follow ? fox.x + leadX : fox.x + (glidedX - fox.x) * held;
  const goalZ = rig.follow ? fox.z + leadZ : fox.z + (glidedZ - fox.z) * held;
  const goalYaw = rig.goalYaw + rig.speedYaw * seconds;
  const place = closing(seconds, rig.follow ? 6.5 : 14);
  const x = rig.x + (goalX - rig.x) * place;
  const z = rig.z + (goalZ - rig.z) * place;
  const moved = {
    ...rig,
    distance:
      rig.distance + (rig.goalDistance - rig.distance) * closing(seconds, 9),
    goalX,
    goalYaw,
    goalZ,
    leadX,
    leadZ,
    speedX: rig.follow ? 0 : rig.speedX * fade,
    speedYaw: rig.speedYaw * Math.exp(-seconds * 5.5),
    speedZ: rig.follow ? 0 : rig.speedZ * fade,
    x,
    y: rig.y + (top(x, z) - rig.y) * closing(seconds, 5),
    yaw: rig.yaw + (goalYaw - rig.yaw) * closing(seconds, 12),
    z,
  };
  const need = riseOf(moved, top);
  return {
    ...moved,
    lift:
      rig.lift +
      (need - rig.lift) * closing(seconds, need > rig.lift ? 10 : 2.5),
  };
}

/** The orbit the painter draws a rig from. */
export function orbitOf(rig: Rig): Orbit {
  return {
    distance: rig.distance,
    pitch: Math.min(PITCH.steepest, pitchFor(rig) + rig.lift),
    target: [rig.x, rig.y + 0.45 + rig.distance * 0.012, rig.z],
    yaw: rig.yaw,
  };
}

/**
 * The rig after a drag moved the ground under the finger by `dx`, `dz` blocks
 * in `seconds`: it lets go of the fox, moves at once, and keeps the drag's
 * speed to glide on with when the finger lifts.
 */
export function panRig(rig: Rig, dx: number, dz: number, seconds: number): Rig {
  const from = rig.follow ? { goalX: rig.x, goalZ: rig.z } : rig;
  const keep = Math.min(1, seconds * 18);
  return {
    ...rig,
    follow: false,
    goalX: from.goalX + dx,
    goalZ: from.goalZ + dz,
    speedX: rig.speedX + (dx / seconds - rig.speedX) * keep,
    speedZ: rig.speedZ + (dz / seconds - rig.speedZ) * keep,
    x: rig.x + dx,
    z: rig.z + dz,
  };
}

/**
 * The rig closer (a factor under 1) or farther. While it roams free, the
 * place `toward` on the ground stays under the pointer.
 */
export function zoomRig(
  rig: Rig,
  factor: number,
  toward: readonly [number, number]
): Rig {
  const goalDistance = clamp(
    rig.goalDistance * factor,
    DISTANCE.near,
    DISTANCE.far
  );
  const share = goalDistance / rig.goalDistance;
  return rig.follow
    ? { ...rig, goalDistance }
    : {
        ...rig,
        goalDistance,
        goalX: toward[0] + (rig.goalX - toward[0]) * share,
        goalZ: toward[1] + (rig.goalZ - toward[1]) * share,
      };
}

/** The rig turned by `yaw` and tilted by `tilt` radians in `seconds`, keeping the turn's speed to spin on with; a turn of no time is a step and keeps none. */
export function turnRig(
  rig: Rig,
  yaw: number,
  tilt: number,
  seconds: number
): Rig {
  return {
    ...rig,
    goalYaw: rig.goalYaw + yaw,
    speedYaw:
      seconds > 0
        ? rig.speedYaw +
          (yaw / seconds - rig.speedYaw) * Math.min(1, seconds * 18)
        : rig.speedYaw,
    tilt: clamp(rig.tilt + tilt, TILT.down, TILT.up),
  };
}

/** The rig held still: what a drag left it moving and turning with is gone. */
export function restRig(rig: Rig): Rig {
  return { ...rig, speedX: 0, speedYaw: 0, speedZ: 0 };
}

/** The rig back on the fox, its tilt undone. */
export function followRig(rig: Rig): Rig {
  return { ...rig, follow: true, tilt: 0 };
}
