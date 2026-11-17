/**
 * A lab bench, its hardware and glassware, a cathode-ray tube and a spectrum tube, as a camera sees them.
 * A simulation that shows one of them takes its colour from here, so it looks the same in every lesson.
 */
export const BENCH_COLORS = {
  balanceBody: "#d8d9d4",
  balanceKey: "#5c6066",
  battery: "#202326",
  batteryTerminal: "#b08d57",
  bottleAmber: "#6b3d12",
  bottleCap: "#1f2326",
  bottleClear: "#d9dde0",
  bottleGreen: "#3b4f2b",
  brick: "#7a3b2a",
  cabinet: "#e9e6df",
  ceramicTile: "#e4ddd2",
  coals: "#2a0d04",
  coalGlow: "#ff6a18",
  dish: "#f3f1ec",
  epoxy: "#2a2e33",
  glass: "#e6f2f5",
  // The faint green of thick soda or borosilicate glass seen through its edge.
  glassEdge: "#cfe8d6",
  // A burette's PTFE stopcock key, and the white Schellbach stripe with its
  // blue centre line printed down the back of its tube.
  ptfe: "#f1f0ea",
  // The insulation of a red and a black 4 mm test lead.
  leadBlack: "#1d1e20",
  leadRed: "#b8322c",
  schellbachBlue: "#2f5fb4",
  schellbachWhite: "#f4f6f7",
  lcd: "#16231b",
  lcdGlow: "#0c2416",
  lcdHalo: "#0d1a12",
  lcdInk: "#b8f5c8",
  hotplateBody: "#c9ccc8",
  meterBody: "#2c3a4a",
  meterHalo: "#0b1520",
  meterInk: "#d6f5ff",
  panSteel: "#dfe3e6",
  probeSteel: "#c8cdd2",
  stopper: "#3a2c26",
  trough: "#5b6066",

  // A cathode-ray tube: its zinc sulfide screen, the green glow electrons
  // strike from it, and the violet glow of the trace of gas along the beam.
  phosphorCoat: "#e3ecd9",
  phosphorGlow: "#7dff6a",
  residualGasGlow: "#9c8cff",
  // The pink glow of hydrogen at low pressure in a spectrum tube.
  hydrogenGlow: "#ff5fc8",
} as const;
