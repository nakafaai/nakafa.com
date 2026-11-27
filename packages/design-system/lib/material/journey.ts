import { PLOT_COLORS } from "@repo/design-system/lib/plot";

/**
 * The journey graph lab's objects as a camera sees them: a walnut planning
 * table, a road diorama in a walnut frame with flocked green hills, matt
 * asphalt with white lines, kilometre posts and bus stops with blue shelters,
 * an orange bus and a teal motorbike. Each traveller's line on the graph
 * under the scene takes its plot colour, which its legend in the footer
 * shares, and the vehicle is painted in a lighter tone of it. A simulation
 * that shows one of them takes its colour from here, so it looks the same in
 * every lesson.
 */
export const JOURNEY_COLORS = {
  // The table, the diorama's frame, and its flocked land from the verge to the hilltops.
  table: "#8d6a48",
  frame: "#5d3d27",
  grass: "#6f8f4a",
  meadow: "#8a9c52",
  hill: "#4f7437",
  // The model road's asphalt and paint.
  asphalt: "#4b4d51",
  paint: "#f1efe6",
  // Kilometre posts, and the bus stops: a shelter, its roof and its sign.
  post: "#f2f1ec",
  shelter: "#d6e2e8",
  roof: "#2f6f8f",
  pole: "#5b6168",
  sign: "#1f6fb5",
  // Roadside trees.
  trunk: "#6b4a2f",
  leaves: "#3f6a2e",
  leavesLit: "#5b8a3c",
  // Each traveller's line on the graph, and the paint of its vehicle.
  bus: PLOT_COLORS.orange,
  busPaint: "#e58a2e",
  busRoof: "#f3dcb8",
  bike: PLOT_COLORS.teal,
  bikePaint: "#1aa597",
  // The rise and run drawn on the leg in focus, and the mark where two travellers meet.
  slope: PLOT_COLORS.slate,
  meeting: PLOT_COLORS.pink,
  // Glass, tyres, and the rider's jacket and helmet.
  glass: "#2a3540",
  tyre: "#1c1c1e",
  rider: "#3a4a5c",
  helmet: "#f4f4f1",
} as const;
