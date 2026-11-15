import type { SPECIES } from "@/lib/island/fauna/species";
import { type Paint, type Spot, tint } from "@/lib/island/models/solids";

/** One species of the island's catalog (ADR 0047, D11). */
export type Species = (typeof SPECIES)[number];

/**
 * Which faces of a hide carry the species' mark (ADR 0047, D21): rings for
 * stripes and bands, scattered faces for spots, broad blotches for patches.
 */
const MARKS = {
  bands: (spot: Spot) => spot.segment % 3 === 1,
  none: () => false,
  patch: (spot: Spot) =>
    (Math.floor(spot.segment / 2) * 5 + Math.floor((spot.side + 1) / 2) * 3) %
      4 ===
    1,
  spots: (spot: Spot) => (spot.segment * 3 + (spot.side + 1) * 5) % 7 === 0,
  stripes: (spot: Spot) => spot.segment % 2 === 1,
} satisfies Record<Species["pattern"], (spot: Spot) => boolean>;

/**
 * A species' colors for its 3D model (ADR 0047, D21), from the same ramps its
 * field-guide picture is painted in: the body a tone above the base, so the
 * renderer's light and shade land on it as on the blocks; the belly a tone
 * lighter, legs and marks a tone darker, eyes and dark parts in ink, horns
 * pale. `hide` paints a body: belly underneath, the mark in its pattern. A
 * heavy beast's patch is a saddle round its middle on legs in its accent, as
 * a panda's black band and legs or a tapir's pale saddle.
 */
export function coatOf(species: Species) {
  const { accent, belly, body, mark } = species.coat;
  const saddled = species.family === "heavy" && species.pattern === "patch";
  const colors = {
    accent: tint(accent, 2),
    belly: tint(belly, 3),
    body: tint(body, 2),
    dark: tint("ink", 1),
    eye: tint("ink", 0),
    leg: saddled ? tint(accent, 1) : tint(body, 1),
    mark: tint(mark, 1),
    pale: tint("plaster", 2),
  };
  const marked = saddled
    ? (spot: Spot) => spot.along > 0.45 && spot.along < 0.78
    : MARKS[species.pattern];
  const hide: Paint = (spot) => {
    if (spot.up < -0.75) {
      return colors.belly;
    }
    return marked(spot) ? colors.mark : colors.body;
  };
  return { ...colors, hide };
}

/** A species' colors, as `coatOf` gives them. */
export type Coat = ReturnType<typeof coatOf>;
