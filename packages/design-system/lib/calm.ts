const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Whether the person asked, in their system, for less motion. The code that
 * moves things without React, the toys and the eyes, asks here.
 */
export function isCalm() {
  return window.matchMedia(REDUCED_MOTION).matches;
}
