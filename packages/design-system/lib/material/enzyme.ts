/**
 * Metabolism and enzyme bench colors: active-site molecules, water bath and
 * iodine/albumen indicators, Michaelis-Menten saturation particles, cutaway
 * pancreatic acinar cell organelles, and immobilised lactase alginate column.
 */
export const ENZYME_COLORS = {
  // Active site lab.
  lactase: "#3d82b8",
  sucrase: "#7b5eb8",
  maltase: "#2f9678",
  lactose: "#e5a632",
  sucrose: "#d96b43",
  maltose: "#6ea83d",
  glucose: "#f2c14e",
  galactose: "#5db7d6",
  fructose: "#e87898",
  water: "#52a9d6",
  fitYes: "#2f9e66",
  fitNo: "#d64545",

  // Denature lab.
  bathGlass: "#b8d9e8",
  bathWater: "#7bc2de",
  thermometerMercury: "#d94343",
  iodineYellow: "#d49c2a",
  iodineBlueBlack: "#1e223d",
  albumenCloudy: "#ebe8dc",
  albumenClear: "#d4eaf2",
  lensRim: "#424a54",
  enzymeIntact: "#2f9e66",
  enzymeDenatured: "#c45a4a",

  // Saturation lab.
  vesselGlass: "#cfe3ec",
  enzymeFree: "#3d82b8",
  enzymeBusy: "#e8922d",
  substrateDot: "#e5b832",
  productDot: "#3db466",
  curveStroke: "#3d82b8",
  curveCursor: "#e8922d",

  // Secretion lab (acinar cell).
  cellShell: "#ecd6c5",
  cytoplasm: "#f4e8dc",
  nucleus: "#6e4c9c",
  reticulum: "#4b8ab8",
  ribosome: "#2e4663",
  golgi: "#d9883b",
  vesicle: "#3aa372",
  cargo: "#f2c14e",
  ductWall: "#d9b4a0",

  // Lactase column lab.
  glassColumn: "#c9e2ed",
  alginateBead: "#52b38c",
  milkLiquid: "#f7f4ea",
  stripBase: "#f2ecd8",
  stripPositive: "#2f9e66",
  stripNegative: "#d9c98c",
  labelInk: "#22252a",
} as const;
