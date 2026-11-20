/**
 * The counterexample lab's objects as a camera sees them: a charcoal wool
 * felt board in an oiled oak frame, thick maple number tiles printed in dark
 * ink, painted wooden shapes, a white card printed with the claim, and a
 * rubber stamp in red or green ink. On the case board of an implication, the
 * felt of each cell is dyed for what its case does to the claim. The spot
 * under a checked tile and the dot of the footer's key share one colour for
 * each verdict, named as the verdict is. A simulation that shows one of them takes its
 * colour from here, so it looks the same in every lesson.
 */
export const COUNTEREXAMPLE_COLORS = {
  // The felt board and its oak frame, and the oak strips between the cells.
  felt: "#3d4249",
  frame: "#a87a4f",
  // Maple tiles, the ink printed on them, and the paint of the shapes.
  tile: "#ead9b8",
  ink: "#24272c",
  red: "#c8352e",
  blue: "#2a5fb8",
  yellow: "#e7b526",
  green: "#2f8a49",
  // The claim card's stock and the ink it is printed in.
  card: "#f7f5ef",
  print: "#24272c",
  // One colour for each verdict: a tile that breaks the claim, one that fits
  // it or proves it, one that misses it, and one outside it or safe; and the
  // spot under a picked tile while the answer stays hidden.
  breaks: "#e5483f",
  fits: "#3db466",
  proves: "#3db466",
  misses: "#c49a5a",
  outside: "#8b929b",
  safe: "#8b929b",
  picked: "#f2b63c",
  // The dyed felt of the case board's cells.
  feltBreaks: "#5a3434",
  feltFits: "#2f4a3a",
  feltSafe: "#474b51",
} as const;
