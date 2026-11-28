/**
 * A push on a door in the door's own frame, seen from above: the hinge line
 * on the origin, the door along +x, and -z the way it swings open, away from
 * the person who pushes it. Every pair is an x and a z, in metres.
 */

/** How long the door rests wide open before it closes and is pushed again, in seconds. */
const REST = 1.2;

/** The longest a slow swing is shown before it starts again, in seconds. */
const LONGEST = 8;

/**
 * A push drawn `length` long at `arm` metres from the hinge and `angle`
 * degrees from the door: where the hand meets the door, the push as a
 * vector, and its part square to the door, the only part that turns it.
 */
export function pushVectors(arm: number, angle: number, length: number) {
  const turn = (angle * Math.PI) / 180;
  const across = -Math.sin(turn) * length;
  return {
    force: [Math.cos(turn) * length, across],
    hand: [arm, 0],
    square: [0, across],
  } as const;
}

/**
 * How long one showing of the swing lasts for an angular acceleration
 * `spin`, in seconds: the time the door takes to reach wide open from
 * rest, capped for a push that barely turns it, and the rest after it.
 */
export function swingPeriod(spin: number) {
  return Math.min(Math.sqrt(Math.PI / Math.max(spin, 1e-6)), LONGEST) + REST;
}
