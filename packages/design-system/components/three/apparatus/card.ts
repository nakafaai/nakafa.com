/**
 * A burette reader: a white card with a black band across it, held behind a
 * burette so the top of the band is just under the meniscus. The black
 * band, seen through the liquid, darkens the curve of the meniscus into a
 * sharp line against the white, which is how a burette is read to 0.05 mL.
 * Every length is in metres.
 */
export const CARD = {
  /** How far under the meniscus the top of the band is. */
  below: 0.001,
  /** How far behind the burette's wall the card stands. */
  clear: 0.003,
  /** How tall the black band is. */
  band: 0.018,
  /** How tall and wide the card is, and how thick. */
  height: 0.05,
  thick: 0.0008,
  width: 0.034,
} as const;

/**
 * Where a reader card stands behind a burette whose meniscus is at a
 * height: the middle of the card, the middle of its band, and how far
 * behind the burette's axis both are.
 *
 * @param meniscus - The height of the meniscus, in metres
 * @param radius - The burette's outer radius, in metres
 */
export function cardOf(meniscus: number, radius: number) {
  const top = meniscus - CARD.below;
  return {
    back: -(radius + CARD.clear + CARD.thick / 2),
    band: top - CARD.band / 2,
    middle: top + CARD.band / 2 - CARD.height / 2 + CARD.height * 0.18,
  };
}
