import { Animal } from "@repo/mascot/animal";
import { Array as Arr, Number as Num, Schema } from "effect";

/**
 * How many animals the pool holds and how big each one is. Their discs cover
 * about half of the pool's area on every screen. A bigger pool holds more
 * animals, and when the catalog runs out the animals grow instead of repeating.
 */

/** The share of the pool's area that the discs of the animals cover. */
const COVER = 0.5;
/**
 * The radius of each animal in turn, by its place in the pool, in pixels. Animals
 * come in six sizes, from 60 to 112 pixels across.
 */
export const ANIMAL_RADII: readonly number[] = [30, 38, 38, 46, 46, 56];
/** The narrowest screen that shows the pool: the lg breakpoint, 64 rem at 16 pixels a rem. */
const NARROWEST_SCREEN = 1024;
/** The share of the width of the pool that the artwork takes: four of the seven columns from the lg breakpoint up. */
const ARTWORK_SHARE = 4 / 7;
/** The shortest height that the sign-in page is checked at, in pixels. */
const SHORTEST_HEIGHT = 640;
/** The width of a 4K screen, the widest that the pool is sized for, in pixels. */
const WIDEST_SCREEN = 3840;
/** The height of a 4K screen, in pixels. */
const TALLEST_SCREEN = 2160;

/** The mean area of a disc of the animal sizes, in square pixels. */
const MEAN_DISC =
  Arr.reduce(
    ANIMAL_RADII,
    0,
    (total, radius) => total + Math.PI * radius * radius
  ) / ANIMAL_RADII.length;

/** The animals whose discs cover the share of a pool of this size, before any limit. */
function wantedAnimals(width: number, height: number) {
  return (COVER * width * height) / MEAN_DISC;
}

/**
 * The fewest animals: the pool on the narrowest screen that shows it, the lg
 * breakpoint wide, at the shortest height.
 */
const FLOOR = Math.round(
  wantedAnimals(NARROWEST_SCREEN * ARTWORK_SHARE, SHORTEST_HEIGHT)
);
/**
 * The most animals: the pool on the widest screen, or the whole catalog when
 * that is smaller. No animal appears twice, so a catalog that is too small makes
 * the animals grow.
 */
const CEILING = Math.min(
  Animal.literals.length,
  Math.round(wantedAnimals(WIDEST_SCREEN * ARTWORK_SHARE, TALLEST_SCREEN))
);

/** The animals of a pool: how many there are, and how much their sizes grow from the radii above. */
export const Cover = Schema.Struct({
  animals: Schema.Int,
  scale: Schema.Finite,
});

/** The animals of a pool. */
export type Cover = typeof Cover.Type;

/**
 * The animals of a pool in a box of this size. The count is the animals that
 * cover the share of the area, kept between the floor and the ceiling. When the
 * count stops at the ceiling, the scale grows the sizes so that the discs still
 * cover the share.
 */
export function coverOf(width: number, height: number): Cover {
  const wanted = wantedAnimals(width, height);
  const animals = Num.clamp(Math.round(wanted), {
    maximum: CEILING,
    minimum: FLOOR,
  });
  return { animals, scale: Math.max(1, Math.sqrt(wanted / animals)) };
}
