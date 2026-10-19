import { cast } from "@repo/mascot/seed";
import { Array as Arr } from "effect";

/** The seed that names the animals of the marketing pages. */
const HOME_SEED = "nakafa-home";

/**
 * How many animals the toys of the page take: seven around the hero's title,
 * two where each of twelve parts begins, two in the privacy room and two
 * beside the founder's letter.
 */
const TOY_COUNT = 35;

/** How many friends stand in the crowd of the community part. */
const CROWD_COUNT = 18;

/** Every this many friends of the crowd, one of them is typing, so a bubble of dots rises above it. */
export const CROWD_TYPING_EVERY = 4;

/** How many animals sit in the class photo of the school part. */
const CLASS_COUNT = 7;

/**
 * How many animals the page keeps for its sparse parts after its class: two
 * beside the memory desk, one below it, and one each below the school band and
 * the closing question.
 */
const SPARE_COUNT = 5;

/** How many animals the home page takes from the start of the cast. */
const HOME_COUNT = TOY_COUNT + CROWD_COUNT + CLASS_COUNT + SPARE_COUNT;

/**
 * How many animals the toys of the pricing page take: two pairs beside each of
 * three parts, and a herd of two in the middle of each.
 */
const PRICING_TOY_COUNT = 12;

/** How many animals sit in the class of the pricing page. */
const PRICING_CLASS_COUNT = 7;

/** How many animals the pricing page keeps for the plans and the sides of its parts. */
const PRICING_SPARE_COUNT = 8;

/**
 * The cast of the home page. It takes its toys, crowd, class and spare animals
 * as slices of it, in that order, so no animal appears twice on the page.
 */
export const HOME_CAST = cast(HOME_SEED, HOME_COUNT);

/** The animals of the toys, from the start of the cast. */
export const TOY_HERD = Arr.take(HOME_CAST, TOY_COUNT);

/** The friends of the crowd, straight after the toys. */
export const CROWD_HERD = Arr.take(Arr.drop(HOME_CAST, TOY_COUNT), CROWD_COUNT);

/** The animals of the class, straight after the crowd. */
export const CLASS_HERD = Arr.take(
  Arr.drop(HOME_CAST, TOY_COUNT + CROWD_COUNT),
  CLASS_COUNT
);

/** The animals the home page keeps for its sparse parts, at the end of the cast. */
export const SPARE_HERD = Arr.drop(
  HOME_CAST,
  TOY_COUNT + CROWD_COUNT + CLASS_COUNT
);

/** The seed that names the animals of the pricing page. */
const PRICING_SEED = "nakafa-pricing";

/**
 * The cast of the pricing page, its own, so no animal appears twice on it. The
 * home page holds most of the animals there are, so the pricing page draws from
 * all of them again rather than from what the home page leaves.
 */
const PRICING_CAST = cast(
  PRICING_SEED,
  PRICING_TOY_COUNT + PRICING_CLASS_COUNT + PRICING_SPARE_COUNT
);

/** The animals of the pricing toys, from the start of their slice. */
export const PRICING_TOY_HERD = Arr.take(PRICING_CAST, PRICING_TOY_COUNT);

/** The animals of the pricing class, straight after the toys. */
export const PRICING_CLASS_HERD = Arr.take(
  Arr.drop(PRICING_CAST, PRICING_TOY_COUNT),
  PRICING_CLASS_COUNT
);

/** The animals the pricing page keeps for its plans and the sides of its parts. */
export const PRICING_SPARE_HERD = Arr.drop(
  PRICING_CAST,
  PRICING_TOY_COUNT + PRICING_CLASS_COUNT
);
