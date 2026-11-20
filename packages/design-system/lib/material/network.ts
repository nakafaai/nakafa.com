/**
 * The road network lab's objects as a camera sees them: a planning table of
 * oiled beech, a model board flocked as grass with a painted edge, model
 * roads of matt asphalt, small rendered houses with clay and slate roofs,
 * white sign boards on walnut posts, plates for the road lengths, the start
 * and end flags, and an orange delivery van. A road lit for a town or a route
 * takes one of two paints, so the two modes never read alike. A simulation
 * that shows one of them takes its colour from here, so it looks the same in
 * every lesson.
 */
export const NETWORK_COLORS = {
  // The planning table and the model board on it.
  table: "#b38a5f",
  grass: "#6c8a4a",
  boardEdge: "#3c3a35",
  // Model asphalt, and the paints a road takes when lit.
  road: "#4b4d51",
  degreeLit: "#e2a321",
  routeLit: "#2f78c8",
  // Rendered walls, clay and slate roofs.
  wall: "#efe7d6",
  wallWarm: "#e3cfae",
  roofClay: "#a9472f",
  roofSlate: "#7c7774",
  // A town square of pale paving.
  square: "#aaa397",
  // Sign boards and their posts, and the plates of the road lengths.
  sign: "#f6f3ea",
  post: "#5b4636",
  // The flags of the trip's start and end.
  start: "#2e8a57",
  end: "#c23a2c",
  // The delivery van: orange paint, so it stands out on a lit road, a white
  // roof, tinted glass and black tyres.
  van: "#e5782a",
  vanRoof: "#f3f3f0",
  vanGlass: "#26303b",
  tyre: "#1c1c1e",
} as const;
