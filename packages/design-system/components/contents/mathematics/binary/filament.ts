/**
 * A tungsten filament does not switch like an LED. Its own heat makes the
 * light, so a lamp turned on brightens over the tens of milliseconds the
 * coil takes to reach about 2700 K, and a lamp turned off fades a little more
 * slowly while the coil cools. The glow here runs from 0, cold, to 1, full
 * brightness, and closes on its target exponentially.
 */

/** How long a filament takes to reach full glow, and to go dark, in seconds. */
export const FILAMENT_SECONDS = { cool: 0.12, warm: 0.08 } as const;

/** A glow this close to its target is the target, so a still lamp stops asking for frames. */
const SETTLED = 0.003;

/**
 * The glow of a filament `seconds` after it glowed `glow`, while its switch
 * is `on`. Three time constants fit in the warm-up or the cool-down, so the
 * glow covers 95% of the way in that time.
 */
export function heatFilament(glow: number, on: boolean, seconds: number) {
  const target = on ? 1 : 0;
  const constant = (on ? FILAMENT_SECONDS.warm : FILAMENT_SECONDS.cool) / 3;
  const next = target + (glow - target) * Math.exp(-seconds / constant);
  return Math.abs(next - target) < SETTLED ? target : next;
}

/** Whether a filament has reached the glow of its switch and needs no more frames. */
export function filamentSettled(glow: number, on: boolean) {
  return glow === (on ? 1 : 0);
}
