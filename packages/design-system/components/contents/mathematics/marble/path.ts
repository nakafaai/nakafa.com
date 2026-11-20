import type { DrawRule } from "@repo/design-system/components/contents/mathematics/marble/draw";
import type { Slot } from "@repo/design-system/components/contents/mathematics/marble/jar";
import {
  JAR,
  MARBLE_RADIUS,
} from "@repo/design-system/components/contents/mathematics/marble/jar";
import {
  progress,
  STEPS,
} from "@repo/design-system/components/contents/mathematics/marble/run";
import { Vector3 } from "three";

/**
 * The paths a drawn marble follows in a slow trial: out of the pile to the
 * hand above the jar's mouth, then back into the jar or over to the dish,
 * each step eased so the marble starts and stops as a hand moves it.
 */

/** Where the jar stands on the table, in metres. */
export const JAR_AT = new Vector3(-0.055, 0, -0.01);

/** Where the dish for a kept marble stands. */
export const DISH_AT = new Vector3(0.095, 0.009, 0.0);

/** Where the jar's lid lies, behind the jar and to its left. */
export const LID_AT = new Vector3(-0.17, 0, -0.07);

/** Where a drawn marble is held up to be read: just above the jar's mouth. */
export const HELD = new Vector3(
  JAR_AT.x + 0.02,
  JAR.height + 0.05,
  JAR_AT.z + 0.03
);

/** A point on a marble's path between two places, lifted by `arc` metres at its middle. */
export function along(from: Vector3, to: Vector3, share: number, arc: number) {
  return new Vector3()
    .lerpVectors(from, to, share)
    .setY(from.y + (to.y - from.y) * share + arc * 4 * share * (1 - share));
}

/** The world position of a slot in the jar. */
export function slotAt(slot: Slot) {
  return new Vector3(JAR_AT.x + slot.x, JAR_AT.y + slot.y, JAR_AT.z + slot.z);
}

/** Where a drawn marble breaks the surface of the pile, straight above its slot. */
export function surfaceAt(slot: Slot, top: number) {
  return new Vector3(
    JAR_AT.x + slot.x,
    JAR_AT.y + top + MARBLE_RADIUS,
    JAR_AT.z + slot.z
  );
}

/** Where the first marble of a slow trial is at `elapsed` seconds. */
export function firstPlace(
  elapsed: number,
  rule: DrawRule,
  start: Vector3,
  rest: Vector3
) {
  if (elapsed < STEPS.firstHeld) {
    return along(start, HELD, progress(elapsed, 0, STEPS.firstHeld), 0);
  }
  if (elapsed < STEPS.firstRead) {
    return HELD.clone();
  }
  if (rule === "replace") {
    return elapsed < STEPS.firstPlaced
      ? along(
          HELD,
          start,
          progress(elapsed, STEPS.firstRead, STEPS.firstPlaced),
          0
        )
      : rest;
  }
  if (elapsed < STEPS.firstPlaced) {
    return along(
      HELD,
      DISH_AT.clone().setY(DISH_AT.y + MARBLE_RADIUS),
      progress(elapsed, STEPS.firstRead, STEPS.firstPlaced),
      0.03
    );
  }
  if (elapsed < STEPS.secondRead) {
    return DISH_AT.clone().setY(DISH_AT.y + MARBLE_RADIUS);
  }
  return along(
    DISH_AT.clone().setY(DISH_AT.y + MARBLE_RADIUS),
    start,
    progress(elapsed, STEPS.secondRead, STEPS.returned),
    0.06
  );
}

/** Where the second marble of a slow trial is at `elapsed` seconds. */
export function secondPlace(elapsed: number, start: Vector3, rest: Vector3) {
  if (elapsed < STEPS.firstPlaced) {
    return rest;
  }
  if (elapsed < STEPS.secondHeld) {
    return along(
      start,
      HELD,
      progress(elapsed, STEPS.firstPlaced, STEPS.secondHeld),
      0
    );
  }
  if (elapsed < STEPS.secondRead) {
    return HELD.clone();
  }
  return along(
    HELD,
    start,
    progress(elapsed, STEPS.secondRead, STEPS.returned),
    0
  );
}
