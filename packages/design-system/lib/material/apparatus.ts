/**
 * The benchtop apparatus of the physics labs as a camera sees it: the oak
 * baseboard a circuit is screwed to, bakelite and enamelled instrument cases,
 * tungsten and nichrome at rest and at white heat, the laminated iron and
 * enamelled copper of a transformer, the painted poles of a magnet, the
 * liquids of a manometer and a hydraulic jack, melting ice and steam, and the
 * brass and mica of a Geiger-Muller tube with the nucleons it counts. A lab
 * that shows one of them takes its colour from here, so it looks the same in
 * every lesson.
 */
export const APPARATUS_COLORS = {
  // The dark late wood of oak and the end grain of beech, for the stands of
  // the measuring instruments.
  oakDark: "#6f4522",
  beechEnd: "#a67c4a",
  // Instrument cases.
  caseEnamel: "#d9d5c8",
  caseSteel: "#5b6470",
  caseDark: "#2a2f37",
  // Leads and terminals.
  leadRed: "#c62828",
  leadBlack: "#1c1f24",
  leadBlue: "#1e5fbf",
  leadYellow: "#d9a514",
  leadGreen: "#2f8f4e",
  nickel: "#c9ccd1",
  // The light of a lamp.
  lampHalo: "#ffd68a",
  // A dry cell's printed jacket.
  cellJacket: "#1d3f8f",
  cellStripe: "#e3b23c",
  // Chips and their indicator lamps.
  chipBody: "#191a1d",
  chipNotch: "#33363b",
  transistorBody: "#1b1c1f",
  ledRed: "#ff3b30",
  ledGreen: "#30d158",
  ledAmber: "#ffb020",
  ldrFace: "#c2452d",
  ldrTrack: "#f3e6c8",
  // A transformer and a magnet.
  enamelCopper: "#b5652f",
  bobbin: "#22262c",
  fluxGlow: "#5ad1ff",
  poleNorth: "#c0392b",
  poleSouth: "#2b5fb3",
  plasticPipe: "#e8e4d8",
  eddyGlow: "#ffb020",
  forceArrow: "#22b573",
  weightArrow: "#e0457b",
  // Liquids and the vessels that hold them.
  water: "#8cc7e8",
  waterDeep: "#4f9fd0",
  dyedWater: "#2f8fe0",
  oil: "#d9a933",
  hydraulicOil: "#c2412d",
  tracer: "#ffffff",
  rubberTube: "#7a2f24",
  scalePaper: "#f3efe2",
  scaleInk: "#22252a",
  // Heat: melted wax, bubbles and the alcohol of a thermometer.
  waxMelt: "#d8c592",
  bubble: "#eaf6ff",
  alcohol: "#d22f3a",
  heaterSheath: "#b8bcc2",
  gasCool: "#5fa8ff",
  gasHot: "#ff5a3c",
  // A Geiger-Muller tube, its source, and what it counts.
  sourceHolder: "#e0b23a",
  betaTrack: "#69e0ff",
  counterLed: "#ff4136",
  proton: "#e5484d",
  neutron: "#8b95a5",
  neutronFree: "#cfd6e0",
  fissionFlash: "#ffe08a",
  photonViolet: "#8f5bff",
  photonBlue: "#3a78ff",
  photonGreen: "#35c26b",
  photonYellow: "#f2c230",
  photonOrange: "#ff8a2a",
  photonRed: "#ff3b30",
  photonUltra: "#b9a4ff",
  electron: "#7fe3ff",
} as const;
