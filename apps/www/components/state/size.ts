/** Her width on a full-page state, in pixels. */
export const NINA_SIZE = 176;

/** The side of each thing that lies beside her. */
export const THING_SIZE = 48;

/** The space between her and each thing. */
export const FIGURE_GAP = 12;

/**
 * The room the three need side by side. With less room the things are left
 * out, and `Beside` writes that threshold in rem, which a browser test holds to
 * this width.
 */
export const FIGURE_WIDTH = NINA_SIZE + 2 * (THING_SIZE + FIGURE_GAP);
