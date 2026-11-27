/**
 * A lamp panel as a camera sees it: clear globe bulbs with tungsten filaments
 * in porcelain holders, chrome toggle switches on steel plates, engraved
 * brass place-value plates, all on a printed circuit board in a walnut
 * case. A simulation that shows one of them takes its colour from here, so it
 * looks the same in every lesson.
 */
export const LAMP_COLORS = {
  // A cold tungsten coil is dark grey; a lit one runs from a dull red through
  // orange to the warm white of about 2700 K that a filament lamp gives.
  filamentCold: "#3d3a36",
  filamentDim: "#ff4a12",
  filamentHot: "#ffb36b",
  // The soft halo a lit globe throws on the air and the faceplate around it.
  glow: "#ffbf80",
} as const;
