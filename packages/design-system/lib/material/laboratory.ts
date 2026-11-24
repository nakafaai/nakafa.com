/**
 * A school biology laboratory as a camera sees it: its painted walls, tiled
 * splashback and floor, the epoxy bench and its sink, the apparatus on it,
 * the protective equipment a learner wears, and the safety equipment on the
 * wall. The safety colours follow ISO 7010 and ISO 3864: safe-condition green
 * for first aid and the eyewash, and fire-equipment red with the black band
 * EN 3 gives a carbon dioxide extinguisher.
 */
export const LABORATORY_COLORS = {
  // The room: emulsion-painted walls, white ceramic splashback tiles and
  // their grout, vinyl floor tiles, and a dark skirting.
  wall: "#e6e1d6",
  wallTile: "#f1f0eb",
  grout: "#b7b4ab",
  floorTile: "#b9b2a3",
  floorGrout: "#8c867b",
  skirting: "#4a4b4d",

  // The bench: a black epoxy resin worktop and sink, laminate doors on a
  // dark plinth, steel handles, a chrome swan-neck tap, and the gas tap's
  // yellow lever and the orange rubber tubing to the burner.
  worktop: "#23262a",
  sink: "#1c1e21",
  cabinet: "#d6d3ca",
  plinth: "#2f3133",
  steel: "#c8cdd2",
  chrome: "#dfe3e7",
  gasLever: "#e0aa1f",
  tubing: "#d4602c",
  shelf: "#c9c4b8",
  socket: "#f3f2ee",

  // Heating: the burner's cast base and brass barrel, the heat-resistant
  // mat, the tripod's iron and the gauze's wire and ceramic centre.
  burnerBase: "#2c2f33",
  brass: "#b48f58",
  mat: "#d9d5cb",
  iron: "#3a3c3f",
  gauzeWire: "#7a7d81",
  ceramic: "#ebe9e2",

  // Culture work: nutrient agar, cream colonies, the clear polystyrene dish,
  // the blue disposable loop, and the two strips of tape on the lid.
  agar: "#d8b46a",
  colony: "#f2ead0",
  polystyrene: "#eef4f6",
  loop: "#2f6ad0",
  tape: "#efe5c4",

  // Dissection: the white tile, steel instruments and the needle's wooden
  // handle; the rack's wood and the dropper's red rubber teat.
  tile: "#f5f4f0",
  wood: "#a97a4c",
  teat: "#b8392a",
  frost: "#f6f6f2",
  stain: "#c25a8c",
  water: "#cfe6ee",
  copperSulfate: "#4f9fd6",

  // Protection: the white cotton coat and its buttons, the goggles' grey
  // frame and black strap, blue nitrile, the pale blue mask and the boxes.
  coat: "#f2f2ee",
  coatShadow: "#d9d9d3",
  button: "#e4e2da",
  goggleFrame: "#5d6870",
  strap: "#242629",
  nitrile: "#4a78c9",
  box: "#f4f4f1",
  boxBand: "#2c5db0",
  mask: "#8ec2e2",
  hook: "#aeb3b8",

  // Safety: fire-equipment red, the carbon dioxide band and horn, the first
  // aid and eyewash green, the eyewash caps' yellow, and the fume chamber's
  // powder-coated steel, its interior and its duct.
  fireRed: "#b8181f",
  carbonBand: "#1b1c1e",
  safeGreen: "#1f7a4d",
  capYellow: "#f0c02c",
  cross: "#fbfbf8",
  chamber: "#e8e6e0",
  chamberInside: "#d3d1ca",
  chamberFrame: "#8f969c",
  duct: "#c4c7c9",
  spot: "#fff4e2",
  amberGlass: "#8a4b16",
  sharpsYellow: "#e8b923",
  biohazardOrange: "#d95b26",
  autoclaveSteel: "#b4bbc2",
  steam: "#edf4f7",
  sulfur: "#e5d43b",
  flame: "#f26b1d",
  flameCore: "#ffe066",
  mercury: "#cfd6dc",
  disinfectant: "#3da6a0",
  cardboard: "#c49a6c",
  paper: "#faf9f5",
  pencil: "#30343a",
} as const;
