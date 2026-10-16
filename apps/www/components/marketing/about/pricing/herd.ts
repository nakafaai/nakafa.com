import { cast } from "@repo/mascot/seed";
import { Array as Arr } from "effect";

/** The seed that names the animals of the pricing page. */
const PRICING_SEED = "nakafa-pricing";

/** How many animals sit in the open space beside the parts of the page. */
const TOY_COUNT = 6;

/** How many animals sit in the class of the school part. */
const CLASS_COUNT = 7;

/**
 * The one cast of the pricing page. Its toys and its class are slices of it, in
 * that order, so no animal appears twice on the page.
 */
const PRICING_CAST = cast(PRICING_SEED, TOY_COUNT + CLASS_COUNT);

/** The animals of the toys, from the start of the cast. */
export const PRICING_TOY_HERD = Arr.take(PRICING_CAST, TOY_COUNT);

/** The animals of the class, at the end of the cast. */
export const PRICING_CLASS_HERD = Arr.drop(PRICING_CAST, TOY_COUNT);
