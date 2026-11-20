/**
 * How the parts move between two states. A torch bulb's filament is a tiny
 * coil, so it reaches full glow in a few hundredths of a second and fades a
 * little slower; a knife switch's blade swings through its arc in a fifth of
 * a second, as a hand throws it.
 */

/** How long the filament takes to warm to full glow and to cool to dark, in seconds. */
export const FILAMENT = { cool: 0.1, warm: 0.06 } as const;

/** How fast a thrown blade swings, in radians a second. */
export const BLADE_SPEED = 5.5;

/** The filament's glow, from 0 cold to 1 full, after `delta` seconds with the current on or off. */
export function heat(level: number, on: boolean, delta: number) {
  return on
    ? Math.min(1, level + delta / FILAMENT.warm)
    : Math.max(0, level - delta / FILAMENT.cool);
}

/** The blade's angle after swinging `delta` seconds toward `target`, never past it. */
export function swing(angle: number, target: number, delta: number) {
  const step = BLADE_SPEED * delta;
  if (Math.abs(target - angle) <= step) {
    return target;
  }
  return angle + Math.sign(target - angle) * step;
}
