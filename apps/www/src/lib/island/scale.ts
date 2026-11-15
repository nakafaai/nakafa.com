/**
 * The island's one unit (ADR 0047, D10): a block is 0.9 m on a side, and
 * everything the world draws is measured in blocks against real things, so a
 * house is never smaller than a tree and no prop is a giant. Prefabs, the
 * village, sprites and their tests all read their sizes from here.
 */
export const SCALE = {
  /** A block's side, in meters. */
  block: 0.9,
  /** A person, villager or learner, stands this many blocks tall. */
  person: 2,
  /** A door's opening, in blocks high. */
  door: 2,
  /** A storey's walls, door and lintel, in blocks. */
  storey: 3,
  /** A cottage: walls 7 by 6, a stepped roof and a chimney, 7 blocks to the top. */
  house: { depth: 6, height: 7, width: 7 },
  /** A grown tree, from the ground to the top of its crown, about a house's height. */
  tree: { from: 6, to: 8 },
  /** A lamp post with its lantern. */
  lamp: 3,
  /** A hen or a duck, about 45 cm. */
  fowl: 0.5,
  /** Nina, a young hammerhead, about 2.3 m long. */
  nina: 2.6,
} as const;
