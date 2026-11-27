/**
 * The marble lab's objects as a camera sees them: swirled glass marbles in
 * five colours, each with ribbons of white glass twisted through it, a clear storage jar with a tin lid, a glazed dish, an oak
 * tabletop and a walnut tally board with beech pegs. A simulation that shows
 * one of them takes its colour from here, so it looks the same in every
 * lesson.
 */
export const MARBLE_COLORS = {
  // Opaque glass marbles, glazed as the common classroom sets are.
  blue: "#1d4f9e",
  green: "#1f7440",
  red: "#ae1f2b",
  white: "#e9e7e1",
  yellow: "#e0ad16",
  // The white glass ribbon twisted through every marble.
  ribbon: "#f4f1ea",
  // The jar: soda-lime glass, faintly green through its thickness.
  jarGlass: "#eef4f2",
  jarTint: "#cfe5d8",
  // A tinplate screw lid with a lacquered top.
  lid: "#b9bcbf",
  lidLacquer: "#8a1c22",
  // A white glazed stoneware dish.
  dish: "#f1eee8",
  // A walnut tally board and its drilled holes.
  walnut: "#5b3a24",
  walnutHole: "#2a190e",
} as const;
