/**
 * The falling-target demonstration: a launcher aims straight at a can held
 * by an electromagnet. Firing cuts the magnet, so the can drops at the
 * instant the ball leaves. Both fall the same height in the same time, so
 * the ball, aimed at where the can was, meets it at any launch speed,
 * unless the can reaches the floor first. Gravity is rounded to 10 m/s², as
 * the lessons do.
 */

/** Gravitational acceleration, in m/s². */
export const AIM_GRAVITY = 10;

/** Where the can hangs: its distance and height from the launcher, in metres. */
export const TARGET = { distance: 4, height: 2 } as const;

/** The launch angle that points straight at the can, in radians. */
export const AIM_ANGLE = Math.atan2(TARGET.height, TARGET.distance);

/** Where the ball and the can are `time` seconds after firing at `speed` m/s; neither goes below the floor. */
export function aimPlaces(speed: number, time: number) {
  const fall = 0.5 * AIM_GRAVITY * time * time;
  return {
    ball: {
      x: speed * Math.cos(AIM_ANGLE) * time,
      y: Math.max(speed * Math.sin(AIM_ANGLE) * time - fall, 0),
    },
    can: { x: TARGET.distance, y: Math.max(TARGET.height - fall, 0) },
  };
}

/**
 * The outcome at one speed: when the ball reaches the can's line, how far
 * the can has dropped by then, and whether the can is still in the air to
 * be hit.
 */
export function aimOutcome(speed: number) {
  const meet = TARGET.distance / (speed * Math.cos(AIM_ANGLE));
  const drop = 0.5 * AIM_GRAVITY * meet * meet;
  return { drop, hit: drop < TARGET.height, meet };
}
