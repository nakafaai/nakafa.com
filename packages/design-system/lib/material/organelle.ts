/**
 * The inside of a cell as a medical illustration lights it: a mitochondrion's
 * membranes and the proteins in them, the bodies of its matrix and of the
 * cytosol around it, and the atoms of the molecules that cross them.
 * A simulation that shows one of them takes its colour from here, so it looks the same in every lesson.
 */
export const ORGANELLE_COLORS = {
  // The membranes: the outer one coral, the inner one and its cristae apricot,
  // each bilayer's cut face a shade paler, and the narrow lumen of a crista
  // dark, as a section shows the space between two membranes.
  outerMembrane: "#d9765a",
  outerSheen: "#ffd9c7",
  innerMembrane: "#e9a25a",
  innerSheen: "#ffe6c4",
  matrixWall: "#c9714a",
  cutFace: "#f2c28f",
  lumen: "#9c4f2e",

  // The proteins on the cristae: ATP synthase heads and the respiratory chain.
  synthase: "#6fa7d8",
  complex: "#b79ac4",

  // The matrix: the DNA of a nucleoid and its dense granules.
  nucleoid: "#5a48b0",
  granule: "#3d302c",

  // The cytosol: ribosomes, and a muscle cell's glycogen.
  ribosome: "#8f7aa8",
  glycogen: "#6b4656",

  // A muscle cell's myofibril, banded as a micrograph shows it: dark A bands
  // with a paler H zone and M line, pale I bands and dark Z discs.
  bandA: "#a5525a",
  bandH: "#c27479",
  bandI: "#e6b0a8",
  bandM: "#7c3742",
  bandZ: "#5a2531",

  // A yeast cell's envelope: its plasma membrane, the glucan and chitin of
  // the inner wall, and the mannoprotein fibrils of the outer wall.
  plasmaMembrane: "#e8c98e",
  glucan: "#efe4c6",
  mannan: "#b39660",

  // Phosphorus as Jmol's CPK table draws it, beside the shared atom colours.
  cpkPhosphorus: "#ff8000",
} as const;
