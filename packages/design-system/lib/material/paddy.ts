/**
 * A flooded rice field with its soil seen in X-ray view: its floodwater, the
 * layers of its soil, rice and maize with their roots, and the cells of a
 * root seen under a lens. PaddyRootLab takes its colour from here.
 *
 * The soil follows Ponnamperuma (1972, The chemistry of submerged soils, Adv.
 * Agron. 24:29-96): a thin yellowish brown oxidised layer over grey reduced
 * (gleyed) mud, a firmer plough pan, and a mottled grey subsoil with rusty
 * iron mottles. Rice roots in flooded soil wear an orange coat of iron oxide
 * where the oxygen they leak meets ferrous iron.
 */
export const PADDY_COLORS = {
  // The floodwater: turbid with suspended clay, olive in the shallows.
  water: "#6c6a46",
  waterDeep: "#4b4a32",

  // The soil profile, top down, flooded and drained.
  oxidised: "#7f6142",
  reduced: "#5a5d58",
  reducedDark: "#46494a",
  pan: "#6c6b63",
  subsoil: "#77756b",
  mottle: "#a5652f",
  drained: "#6e5c46",
  drainedLight: "#87735a",
  organic: "#2e2a22",
  sand: "#b9ab8a",
  mudSurface: "#4f4837",

  // The bund between fields and its grass.
  bund: "#5d5040",
  bundGrass: "#5a7a2e",

  // Rice: leaf blades, sheaths at the base, yellowing tips.
  riceLeaf: "#5b8a2b",
  riceLeafDeep: "#3f6a1f",
  riceSheath: "#a4b46a",
  riceTip: "#b5b05a",
  leafSheen: "#e2f3b0",

  // Maize: broad leaves with a pale midrib, the stalk.
  maizeLeaf: "#4c7a28",
  maizeMidrib: "#c5d29b",
  maizeStalk: "#8fa45a",

  // Roots: young white rice roots, the iron plaque on them, maize roots, and
  // the brown of maize tips killed by a flood.
  riceRoot: "#e8dcc0",
  plaque: "#8f5328",
  maizeRoot: "#efe6cf",
  rootTip: "#f6efdc",
  deadRoot: "#6f5e45",

  // A root section under the lens: living cells, their walls, the lignified
  // rings, the stele, and the empty air spaces.
  cell: "#dfe3c2",
  cellDeep: "#c9cf9e",
  wall: "#f1ecd6",
  lignin: "#b49a58",
  casparian: "#8a6a38",
  vessel: "#d6c48f",
  airSpace: "#2f342c",

  // The gases and the alcohol the scene follows.
  oxygen: "#3fb4ea",
  carbonDioxide: "#e4e7ea",
  ethanol: "#b072e8",

  // A fibreglass measuring stake pushed into the mud, and the lens's rim.
  tape: "#f0c419",
  tapeInk: "#1c1a17",
  lensRim: "#3a3d40",
  lensGlass: "#ffffff",

  // The thin dark edge round each dot of the particle key.
  swatchEdge: "#0000005a",
} as const;
