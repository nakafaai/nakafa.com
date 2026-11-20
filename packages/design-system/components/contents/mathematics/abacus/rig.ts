/**
 * The size of a classroom spike abacus, in metres, with the desk top at
 * y = 0 and the spikes in the plane z = 0. A hardwood base 30 cm long holds
 * four steel spikes 7 cm apart; the wooden beads are 22 mm across and bored
 * to slide on a spike, so a spike 16.5 cm tall takes the ten beads base ten
 * needs for one moment before they carry. A turned pot of loose beads stands
 * to the right of the base, beside the units spike, and every bead that comes
 * onto or off a spike travels between the spike and the pot just above the
 * tips.
 */

/** The base: hardwood 30 cm long, 8 cm deep and 3.6 cm tall, its front tall enough for a place plate. */
export const BOARD = { depth: 0.08, height: 0.036, length: 0.3 } as const;

/** The spikes: 5 mm steel rods rising 16.5 cm above the base, 7 cm apart. */
export const SPIKE = { gap: 0.07, length: 0.165, radius: 0.0025 } as const;

/**
 * A bead: 22 mm across and 14.8 mm tall, bored 6.6 mm wide to slide on a
 * spike. Beads stack 15 mm apart, so neighbours touch without overlapping.
 */
export const BEAD = {
  bore: 0.0033,
  height: 0.0148,
  pitch: 0.015,
  radius: 0.011,
} as const;

/** The brass washer each spike stands in: the lowest bead rests on it. */
export const WASHER = { height: 0.0015, radius: 0.0055 } as const;

/**
 * The turned pot of loose beads: where it stands, its outer radius, height
 * and wall, and how far below its rim the loose beads lie.
 */
export const POT = {
  depth: 0.032,
  height: 0.07,
  radius: 0.042,
  wall: 0.005,
  x: 0.235,
} as const;

/** The height of the base's top face, where the spikes and washers stand. */
export const BOARD_TOP = BOARD.height;

/** The height of a spike's tip. */
export const TIP = BOARD_TOP + SPIKE.length;

/**
 * The height a bead's middle keeps while it travels between the pot and a
 * spike: its bottom passes 6 mm above every tip, so the whole move stays
 * just over the abacus, where the camera sees it.
 */
export const CLEAR = TIP + BEAD.height / 2 + 0.006;

/** The height of the middle of a loose bead lying in the pot. */
export const HEAP = POT.height - POT.depth;

/**
 * The lowest middle a moving bead may have and still show: below it the
 * bead has sunk among the loose beads in the pot.
 */
export const SUNK = HEAP + BEAD.height / 2;

/** Where the spike of `place` stands along the base: the units at the right. */
export function spikeX(place: number) {
  return (1.5 - place) * SPIKE.gap;
}

/** The height of the middle of the bead in `slot` on a spike, counted from 0 at the washer. */
export function slotY(slot: number) {
  return BOARD_TOP + WASHER.height + BEAD.pitch * (slot + 0.5);
}

/** How fast a bead carried onto a spike travels, on average, in metres per second. */
const SPEED = 0.5;

/**
 * How fast a full stack slides up its spike when it carries, in metres per
 * second: slowly enough that each bead leaving the tip is well on its way
 * before the next one leaves.
 */
export const STACK_SPEED = 0.12;

/**
 * How fast a bead flies from a spike's tip to the pot, in metres per second.
 * Beads leave the tip one pitch of the stack apart in time, so they fly more
 * than two bead widths apart: 15 mm / 0.12 m/s × 0.45 m/s ≈ 56 mm.
 */
export const FLIGHT_SPEED = 0.45;

/** How long every leg of a carry lasts at least, in seconds, so a short one still reads. */
const SHORTEST_LEG = 0.18;

/** How long a carried bead takes over a leg `distance` metres long. */
export function legDuration(distance: number) {
  return SHORTEST_LEG + Math.abs(distance) / SPEED;
}

/** A smooth start and stop over one leg: 0 at 0, 1 at 1, still at both ends. */
export function ease(progress: number) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}
