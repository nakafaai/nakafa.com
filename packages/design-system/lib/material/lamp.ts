/**
 * A lamp panel as a camera sees it: clear globe bulbs with tungsten filaments
 * in porcelain holders, chrome toggle switches on steel plates, engraved
 * brass place-value plates, all on a brushed aluminium faceplate in a walnut
 * case. A simulation that shows one of them takes its colour from here, so it
 * looks the same in every lesson.
 */
export const LAMP_COLORS = {
  aluminium: "#b9bec3",
  blankCover: "#8f959b",
  brassCap: "#c6a25b",
  brassPlate: "#b8913f",
  chrome: "#d8dce0",
  // The clear soda-lime glass of a globe bulb, faintly warm at its thick neck.
  globeGlass: "#f4f1e8",
  // A cold tungsten coil is dark grey; a lit one runs from a dull red through
  // orange to the warm white of about 2700 K that a filament lamp gives.
  filamentCold: "#3d3a36",
  filamentDim: "#ff4a12",
  filamentHot: "#ffb36b",
  // The soft halo a lit globe throws on the air and the faceplate around it.
  glow: "#ffbf80",
  leadWire: "#7d7f82",
  lightWarm: "#ffcf99",
  porcelain: "#f1eee6",
  screw: "#8d9196",
  stemGlass: "#e7eee6",
  switchPlate: "#c9cdd1",
  walnut: "#4a2f1f",
  walnutEdge: "#2e1c12",
} as const;
