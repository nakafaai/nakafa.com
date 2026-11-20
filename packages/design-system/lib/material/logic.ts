/**
 * A school circuit kit as a camera sees it: brown hardboard pegboard on an
 * oak desk, parts screwed to black bakelite bases with brass terminal posts,
 * brass knife switches with black handles, two AA cells in a black holder, a
 * 2.5 V torch bulb in a nickel screw holder, a carbon resistor, and PVC leads
 * with steel crocodile clips. A simulation that shows one of them takes its
 * colour from here, so it looks the same in every lesson.
 */
export const LOGIC_COLORS = {
  // The oak desk and the tempered hardboard pegboard on it, its holes dark.
  desk: "#b98b5e",
  hardboard: "#6e4f33",
  hole: "#24170d",
  // Black phenolic bases and handles, brass posts, blades and jaws.
  bakelite: "#26221f",
  brass: "#c9a24a",
  handle: "#121010",
  // Insulating collars that mark the positive and negative posts.
  collarRed: "#b3262b",
  collarBlack: "#1c1a19",
  // The cell holder, the cells' steel ends and their printed wrap.
  holder: "#1b1b1d",
  cellSteel: "#c6c9cc",
  cellWrap: "#1f6f4a",
  cellBand: "#e8c33a",
  // A carbon film resistor: tan body, brown, black, black and gold bands.
  resistorBody: "#d8c49a",
  bandBrown: "#6b3e1f",
  bandBlack: "#161414",
  bandGold: "#c7a44a",
  // The torch bulb: clear glass, a nickel screw cap and holder, and a
  // tungsten coil that runs from dull red to the warm white of a lit lamp.
  bulbGlass: "#f4f1e8",
  nickel: "#a9adb1",
  filamentCold: "#3d3a36",
  filamentDim: "#ff4a12",
  filamentHot: "#ffc27d",
  glow: "#ffc68a",
  lightWarm: "#ffd2a0",
  // PVC lead insulation and the steel of the clips.
  red: "#c0262d",
  black: "#1d1c1c",
  yellow: "#e3b51c",
  blue: "#2459b3",
  green: "#2f8a46",
  orange: "#df6a1c",
  clipSteel: "#b8bcc0",
  // The marks that show current running along a live lead.
  current: "#ffe08a",
} as const;
