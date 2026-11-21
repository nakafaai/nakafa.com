/**
 * A capillary bed as living tissue looks under a microscope, its cut faces
 * coloured as a haematoxylin and eosin section stains them: eosin pinks the
 * cytoplasm, the collagen and the smooth muscle, haematoxylin turns nuclei
 * blue-purple, and red cells keep their own bright red. Water and plasma
 * protein are drawn as markers.
 * A simulation that shows one of them takes its colour from here, so it looks the same in every lesson.
 */
export const CAPILLARY_COLORS = {
  // Blood: red cells bright with oxygen in the arteriole and darker in the venule, white cells pale lilac with their purple lobed nuclei as a blood stain shows them, platelets, and straw-yellow plasma protein.
  arterialCell: "#c8232c",
  venousCell: "#7e1726",
  cellRim: "#e04a3f",
  leukocyte: "#d3c2d8",
  leukocyteNucleus: "#5a3c88",
  platelet: "#d8c6e4",
  protein: "#f0c95a",
  water: "#4fb3e0",
  tissueFluid: "#bfe3ef",
  lymphFluid: "#f6efd6",

  // Vessel walls: thin pale endothelium, the arteriole's eosin-pink smooth muscle, and the fibrous coat outside it.
  endothelium: "#f2d4cc",
  endotheliumNucleus: "#9c6f9a",
  cleft: "#c98f96",
  intima: "#f7e3dc",
  lamina: "#f08aa3",
  muscle: "#c8636f",
  muscleDeep: "#a94c5d",
  muscleNucleus: "#4f2f6b",
  adventitia: "#e8c6bc",
  venuleWall: "#ecc8c4",
  lymphWall: "#f1e8dc",
  sphincter: "#b9505f",

  // Connective tissue: the floor the vessels rest on, its cut faces, collagen bundles, and the tissue cells.
  ground: "#dfb3a9",
  groundDeep: "#cc928f",
  section: "#e6a7b5",
  sectionFibre: "#d1879c",
  sectionNucleus: "#5f3f86",
  collagen: "#f4ddd5",
  cytoplasm: "#eec9c6",
  cellMembrane: "#e3b2b4",
  nucleus: "#5d3f86",
  nucleolus: "#3b2659",
} as const;
