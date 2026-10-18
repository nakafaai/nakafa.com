import { cast } from "@repo/mascot/seed";
import { Array as Arr } from "effect";

/** The seed that names the animals of the marketing pages. */
const HOME_SEED = "nakafa-home";

/**
 * How many animals the toys of the page take: seven around the hero's title,
 * one where each of twelve parts begins, two in the privacy room and two
 * beside the founder's letter.
 */
const TOY_COUNT = 23;

/** How many friends stand in the crowd of the community part. */
const CROWD_COUNT = 18;

/** Every this many friends of the crowd, one of them is typing, so a bubble of dots rises above it. */
export const CROWD_TYPING_EVERY = 4;

/** How many animals sit in the class photo of the school part. */
const CLASS_COUNT = 7;

/** How many animals the home page takes from the start of the cast. */
const HOME_COUNT = TOY_COUNT + CROWD_COUNT + CLASS_COUNT;

/** How many animals sit in the open space beside the parts of the pricing page. */
const PRICING_TOY_COUNT = 6;

/** How many animals sit in the class of the pricing page. */
const PRICING_CLASS_COUNT = 7;

/**
 * The one cast of the marketing pages. The home page takes its toys, crowd and
 * class as slices of it, in that order, and the pricing page takes the slices
 * after them, so no animal appears twice on a page or on both pages.
 */
export const HOME_CAST = cast(HOME_SEED, HOME_COUNT);

/** The animals of the toys, from the start of the cast. */
export const TOY_HERD = Arr.take(HOME_CAST, TOY_COUNT);

/** The friends of the crowd, straight after the toys. */
export const CROWD_HERD = Arr.take(Arr.drop(HOME_CAST, TOY_COUNT), CROWD_COUNT);

/** The animals of the class, at the end of the home cast. */
export const CLASS_HERD = Arr.drop(HOME_CAST, TOY_COUNT + CROWD_COUNT);

/** The animals of the pricing page, straight after the home cast. */
const PRICING_CAST = cast(
  HOME_SEED,
  PRICING_TOY_COUNT + PRICING_CLASS_COUNT,
  HOME_COUNT
);

/** The animals of the pricing toys, from the start of their slice. */
export const PRICING_TOY_HERD = Arr.take(PRICING_CAST, PRICING_TOY_COUNT);

/** The animals of the pricing class, at the end of their slice. */
export const PRICING_CLASS_HERD = Arr.drop(PRICING_CAST, PRICING_TOY_COUNT);
