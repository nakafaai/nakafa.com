import { Match, Schema } from "effect";

/**
 * How ink meets what it is printed on, so a print answers the light as the
 * real thing does:
 * - `ink`: ink printed flat on a part, such as the numbers of a dial face
 *   or a wooden tile; it takes the sheen of what it lies on, a little duller
 * - `enamel`: enamel fired onto glass or a plate; it stands proud of the
 *   surface and shines like the glass it was melted into
 * - `engraving`: marks cut into a part and filled with paint; they sit below
 *   the surface, and the cut is duller than the metal round it
 * - `paper`: a paper label or card that brings its own stock
 * - `display`: a liquid-crystal display lit from behind
 */
export const StockSchema = Schema.Literals([
  "display",
  "enamel",
  "engraving",
  "ink",
  "paper",
]);
type Stock = typeof StockSchema.Type;

/** How rough and how metallic the part under a print is. */
const SubstrateSchema = Schema.Struct({
  metalness: Schema.Finite,
  roughness: Schema.Finite,
});
type Substrate = typeof SubstrateSchema.Type;

/** What a print lies on when it stands alone: neither polished nor metal. */
export const PLAIN_SUBSTRATE: Substrate = { metalness: 0, roughness: 0.5 };

/** A roughness held between a mirror and chalk. */
function rough(value: number) {
  return Math.min(1, Math.max(0.04, value));
}

/**
 * How a print of one stock answers the light on a given substrate: how much
 * clear glaze lies over it, how strongly it glows by itself, how metallic
 * and how rough it is, and its relief: above 0 it stands proud of the
 * surface, below 0 it is cut into it.
 */
export function finishOf(stock: Stock, substrate: Substrate) {
  return Match.value(stock).pipe(
    Match.when("ink", () => ({
      coat: 0,
      glow: 0,
      metalness: 0,
      relief: 0,
      roughness: rough(substrate.roughness + 0.12),
    })),
    Match.when("enamel", () => ({
      coat: 0.6,
      glow: 0,
      metalness: 0,
      relief: 1,
      roughness: 0.28,
    })),
    Match.when("engraving", () => ({
      coat: 0,
      glow: 0,
      metalness: substrate.metalness * 0.3,
      relief: -1,
      roughness: rough(substrate.roughness + 0.3),
    })),
    Match.when("paper", () => ({
      coat: 0,
      glow: 0,
      metalness: 0,
      relief: 0,
      roughness: 0.86,
    })),
    Match.when("display", () => ({
      coat: 1,
      glow: 0.9,
      metalness: 0,
      relief: 0,
      roughness: 0.3,
    })),
    Match.exhaustive
  );
}
