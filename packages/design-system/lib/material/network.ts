/**
 * The road network lab's objects as a camera sees them: a planning table of
 * oiled beech, a raised-relief map in a walnut frame, printed in hypsometric
 * tints with brown contour lines, braided cords for the roads, polished brass
 * map pins in brass grommets for the towns, enamel plates for the road
 * lengths, enamelled pin heads for the trip's start and end, and a lit glass
 * bead that runs a route. A road lit for a town or a route takes one of two
 * colours, so the two modes never read alike. A simulation that shows one of
 * them takes its colour from here, so it looks the same in every lesson.
 */
export const NETWORK_COLORS = {
  // The map's hypsometric tints, valley floor to summit, and its contour ink.
  valley: "#7fa45f",
  meadow: "#b7c27a",
  upland: "#d9c08a",
  summit: "#efe6d2",
  contour: "#7a5632",
  // A road's braided cotton cord, and the colours a road takes when lit.
  road: "#3b3d42",
  degreeLit: "#ffb21f",
  routeLit: "#3f93ff",
  // The enamel plates of the road lengths.
  sign: "#f6f3ea",
  // The enamelled pin heads of the trip's start and end.
  start: "#2e8a57",
  end: "#c23a2c",
  // The lit glass bead that runs a route.
  bead: "#ffd27a",
} as const;
