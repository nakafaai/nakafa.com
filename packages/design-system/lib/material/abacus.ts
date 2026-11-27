/**
 * A classroom spike abacus on a school desk: an oiled walnut base with a
 * moulded plinth, polished brass rods standing in turned brass collars, a
 * printed place-value card, a turned walnut pot of loose beads, and turned
 * wooden beads stained and lacquered one colour per place, as a teaching set
 * colours them so a learner never mixes up the units and the base.
 * A simulation that shows one of them takes its colour from here, so it looks the same in every lesson.
 */
export const ABACUS_COLORS = {
  // The walnut of the base, the darker end grain of its plinth, and the oak
  // of the desk it stands on.
  base: "#8a5a36",
  plinth: "#6f452a",
  desk: "#b98b5e",
  // Polished brass rods and the brass of their collars.
  brass: "#d4aa52",
  brassShade: "#a57c2e",
  // The white board of the place-value card and its printed column rules.
  card: "#e6d3ad",
  cardRule: "#8c8577",
  // The turned walnut pot that holds the loose beads.
  pot: "#5b3a24",
  // Lacquered beads: units green, the base blue, its square red and its cube
  // a mustard yellow.
  beadUnits: "#2f7d4a",
  beadBase: "#2c5ea8",
  beadSquare: "#b3332e",
  beadCube: "#d9a527",
} as const;
