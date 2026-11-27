/**
 * The set-sorting lab's objects as a camera sees them: a natural canvas
 * activity mat with a grey binding, three plastic hula hoops in colours no
 * object shares, a wooden tray, and the everyday objects sorted into them.
 * A simulation that shows one of them takes its colour from here, so it
 * looks the same in every lesson.
 */
export const VENN_COLORS = {
  // The canvas mat and the cotton tape bound round its edge.
  mat: "#d8d2c3",
  binding: "#575c63",
  // Hula hoops: purple for A, orange for B, pink for C.
  hoopA: "#6b3fa0",
  hoopB: "#e0742a",
  hoopC: "#cf4580",
  // The tint printed over the chosen region, and the glow of a chosen object.
  region: "#2bb3c9",
  glow: "#ffcf70",
  // Fruit.
  apple: "#b3242a",
  stem: "#5b3d22",
  leaf: "#4f7d2b",
  lemon: "#f0cf3c",
  lime: "#5f9c2f",
  // Balls: a felt tennis ball and its seam, a steel ball, two plastic balls.
  felt: "#d6e03c",
  seam: "#f1f1e8",
  redBall: "#c9272d",
  blueBall: "#1f5bb5",
  // A die-cast toy car: red paint and tinted windows.
  car: "#b51f24",
  window: "#26323d",
  // Painted wooden blocks.
  redBlock: "#b8322c",
  greenBlock: "#2f7a3b",
  yellowBlock: "#e2b22a",
  // Plastic tumblers.
  blueCup: "#2a66c4",
  greenCup: "#2f9a4c",
} as const;
