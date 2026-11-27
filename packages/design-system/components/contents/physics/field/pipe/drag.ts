/** Gravity, in m s⁻². */
export const GRAVITY = 9.8;

/** The length of each pipe, in metres. */
export const PIPE = 1;

/**
 * The eddy-current drag per unit mass in each pipe, in s⁻¹. These are an
 * illustration, set so a strong magnet takes about five seconds through one
 * metre of thick copper, as classroom demonstrations show: the plastic pipe
 * carries no current, and the slit breaks the loops round the copper pipe,
 * leaving only weak currents.
 */
export const DRAG = { copper: 50, plastic: 0, slit: 6 } as const;

/** The pipes, left to right. */
export const PIPES = ["plastic", "copper", "slit"] as const;
