/**
 * A printed circuit board as a camera sees it: glass-epoxy FR4 laminate under
 * a glossy green solder mask, the copper traces that show paler through the
 * mask, the gold of plated pads and through-holes, white silkscreen ink, and
 * the bare laminate at the board's routed edge. A simulation that shows one
 * takes its colour from here, so it looks the same in every lesson.
 */
export const CIRCUIT_COLORS = {
  // The solder mask over bare laminate, and over copper, where it reads paler.
  mask: "#14613a",
  maskOverCopper: "#35a065",
  // The routed edge of the glass-epoxy laminate.
  laminate: "#b7a66a",
  // The dark of a drilled hole.
  drill: "#10160f",
} as const;
