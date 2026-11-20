/**
 * The yeast fermentation practical as a camera sees it: the suspension, the
 * froth, the oil, the limewater, and the wooden rack the limewater stands in.
 * The glass, rubber, steel and water it shares with the respirometer lab take
 * their colours from RESPIROMETER_COLORS, so both experiments of a lesson
 * stand on one bench.
 * A simulation that shows one of them takes its colour from here, so it looks the same in every lesson.
 */
export const YEAST_COLORS = {
  // Baker's yeast stirred into glucose solution: an opaque, milky tan.
  suspension: "#b08b58",
  // The froth of fine carbon dioxide bubbles on fermenting yeast.
  froth: "#f3ead6",
  // Glucose solution that was boiled and cooled: water clear.
  glucose: "#eef5f3",
  // Light liquid paraffin: clear, a faint straw in a thick layer.
  paraffin: "#ecd98f",
  // Clear limewater, and the white of calcium carbonate held in it.
  limewater: "#eef6f7",
  chalk: "#fdfdfb",
  // A varnished wooden test-tube rack and the darker end grain of its posts.
  rack: "#b88a58",
  rackEnd: "#9d7246",
} as const;
