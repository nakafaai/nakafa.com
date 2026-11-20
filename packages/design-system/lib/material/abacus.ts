/**
 * A classroom spike abacus on a school desk: a beech base with chrome spikes
 * standing in brass washers, a printed place-value card, a turned walnut pot
 * of loose beads, and beads lacquered one colour per place, as a teaching set
 * colours them so a learner never mixes up the units and the base.
 * A simulation that shows one of them takes its colour from here, so it looks the same in every lesson.
 */
export const ABACUS_COLORS = {
  // The beech of the base and the oak of the desk it stands on.
  base: "#d6b48a",
  desk: "#b98b5e",
  // Chrome-plated steel spikes and the brass of their washers.
  chrome: "#d9dde1",
  brass: "#c9a24a",
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
