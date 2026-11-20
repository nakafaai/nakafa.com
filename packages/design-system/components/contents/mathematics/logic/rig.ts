/**
 * The real sizes of the circuit kit, in metres, as a school physics
 * laboratory stocks it: a sheet of hardboard pegboard, parts screwed to small
 * bases with 4 mm terminal posts, and leads with crocodile clips.
 */

/** The pegboard the circuit is built on; its top face lies at `BOARD_TOP`. */
export const BOARD = { depth: 0.28, thickness: 0.006, width: 0.42 } as const;

/** The height of the pegboard's top face above the desk. */
export const BOARD_TOP = BOARD.thickness;

/** Pegboard holes, an inch apart and a little over 6 mm across. */
export const HOLE = { pitch: 0.0254, radius: 0.0032 } as const;

/** How high the base of every part stands on the board. */
export const BASE_HEIGHT = 0.008;

/** A terminal post: its height above the base, its radius, and where a clip bites it. */
export const POST = { bite: 0.006, height: 0.011, radius: 0.0028 } as const;

/** The height at which a crocodile clip bites a terminal post. */
export const BITE_Y = BOARD_TOP + BASE_HEIGHT + POST.bite;

/**
 * The bases of the parts: how long and deep each is, and how far each of its
 * two terminal posts stands from its middle along its length.
 */
export const PARTS = {
  battery: { depth: 0.036, length: 0.132, reach: 0.059 },
  lamp: { depth: 0.032, length: 0.05, reach: 0.018 },
  resistor: { depth: 0.026, length: 0.056, reach: 0.021 },
  switch: { depth: 0.03, length: 0.076, reach: 0.03 },
} as const;

/** A crocodile clip: its length from jaw to boot, and how much higher each clip stacked on one post sits. */
export const CLIP = { length: 0.026, rise: 0.0045 } as const;

/** The radius of a lead's PVC insulation. */
export const WIRE_RADIUS = 0.0016;

/**
 * A knife switch: where its hinge and jaw stand from the base's middle, the
 * height of its blade when closed, and how far the blade swings up when open.
 */
export const KNIFE = {
  blade: 0.04,
  hinge: -0.019,
  jaw: 0.013,
  lift: 0.012,
  open: (60 * Math.PI) / 180,
} as const;
