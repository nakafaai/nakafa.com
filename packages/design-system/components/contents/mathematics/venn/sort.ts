import type { Place } from "@repo/design-system/components/contents/mathematics/venn/layout";

/**
 * The timing of one sorting run, in seconds: the objects leave the tray one
 * after another, each lifted over the mat in an arc and set down in its
 * region, and an object of the chosen operation then rises a little and
 * glows.
 */
export const SORT = {
  /** How long a lifted object takes to reach its place. */
  carry: 0.9,
  /** How long after one object leaves the tray the next one leaves. */
  gap: 0.45,
  /** How high an object is lifted at the top of its arc, in metres. */
  lift: 0.16,
  /** How long an object takes to rise and glow once set down. */
  settle: 0.3,
  /** When the first object leaves the tray. */
  start: 0.5,
} as const;

/** When a run of `count` objects ends: the last one set down and settled. */
export function sortEnd(count: number) {
  return (
    SORT.start + Math.max(0, count - 1) * SORT.gap + SORT.carry + SORT.settle
  );
}

/** The share, 0 to 1, a number lies from `from` to `to`, held at each end. */
function share(value: number, from: number, to: number) {
  return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

/** How far object `index` has come from the tray, 0 waiting to 1 set down. */
export function carried(time: number, index: number) {
  const leaves = SORT.start + index * SORT.gap;
  return share(time, leaves, leaves + SORT.carry);
}

/** How far object `index` has risen and lit since it was set down, 0 to 1. */
export function settled(time: number, index: number) {
  const lands = SORT.start + index * SORT.gap + SORT.carry;
  return share(time, lands, lands + SORT.settle);
}

/** Starts and ends a move gently, as a hand lifts and sets down an object. */
export function ease(progress: number) {
  return progress * progress * (3 - 2 * progress);
}

/**
 * Where an object is on its way from the tray to its place, `progress` from
 * 0 to 1: across the floor eased at both ends, from the tray's floor height
 * to the mat's, and up and down in an arc between them.
 */
export function carryAt(
  from: Place & { readonly y: number },
  to: Place & { readonly y: number },
  progress: number
) {
  const along = ease(progress);
  return {
    x: from.x + (to.x - from.x) * along,
    y:
      from.y +
      (to.y - from.y) * along +
      SORT.lift * Math.sin(Math.PI * progress),
    z: from.z + (to.z - from.z) * along,
  };
}
