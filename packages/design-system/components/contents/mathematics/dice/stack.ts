import { TRAY } from "@repo/design-system/components/contents/mathematics/dice/pose";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr } from "effect";

/**
 * The tally behind the tray: one stack of plastic counting chips for each
 * outcome, on an oak rack, and every roll adds one chip to its outcome's
 * stack. The stacks grow into a frequency histogram, so the tallest stack is
 * the outcome rolled most often. Chips sit a little off true, as stacked
 * chips do, but never far enough to fall.
 */

/** A 19 mm plastic counting chip, 2 mm thick, in metres. */
export const CHIP = { radius: 0.0095, thickness: 0.002 } as const;

/**
 * The oak riser the stacks stand on behind the tray, in metres: taller than
 * the tray's walls, so every stack and the number in front of it shows over
 * the rim. The stacks stand on its back half and each outcome's number on
 * its front half, 30 mm apart, so neighbouring numbers never touch.
 */
export const RACK = {
  depth: 0.05,
  height: 0.078,
  z: -(TRAY.width / 2 + TRAY.wall + 0.04),
} as const;

/** Where the stacks stand on the rack, and its front edge that the numbers hang on, front to back, in metres. */
export const STACK_Z = RACK.z - 0.011;
export const NUMBER_Z = RACK.z + RACK.depth / 2;

/** The distance between the middles of two neighbouring stacks, in metres. */
export const PITCH = 0.03;

/** How far a chip may sit off the middle of its stack, in metres. */
const OFFSET = 0.0006;

/** How wide the rack is for `stacks` stacks: as wide as the tray, or wider when they need it. */
export function rackWidth(stacks: number) {
  return Math.max(TRAY.length + 2 * TRAY.wall, (stacks + 0.5) * PITCH);
}

/** Where stack number `index` of `stacks` stands across the rack. */
export function stackX(index: number, stacks: number) {
  return (index - (stacks - 1) / 2) * PITCH;
}

/**
 * Every chip of the tally, bottom to top in each stack: its centre, and the
 * turn about its own axis that hides its moulding seam somewhere new.
 */
export function chipPlacements(counts: readonly number[]) {
  return Arr.flatMap(counts, (count, stack) =>
    // Arr.makeBy always makes at least one item, so an empty stack makes none here.
    Arr.filter(
      Arr.makeBy(Math.max(1, count), (level) => ({
        position: [
          stackX(stack, counts.length) +
            (hashUnit(stack, level) - 0.5) * 2 * OFFSET,
          RACK.height + (level + 0.5) * CHIP.thickness,
          STACK_Z + (hashUnit(level, stack + 31) - 0.5) * 2 * OFFSET,
        ] as const,
        level,
        spin: hashUnit(stack + 7, level + 3) * 2 * Math.PI,
        stack,
      })),
      (chip) => chip.level < count
    )
  );
}
