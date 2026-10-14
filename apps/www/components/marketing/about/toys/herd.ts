import { cast } from "@repo/mascot/seed";
import { Array as Arr } from "effect";

/** The seed that names the animals of the home page. */
const HOME_SEED = "nakafa-home";

/** How many animals the toys beside the parts of the page take. */
const TOY_COUNT = 17;

/** How many friends stand in the crowd of the community part. */
const CROWD_COUNT = 18;

/** How many animals sit in the class photo of the school part. */
const CLASS_COUNT = 7;

/**
 * The one cast of the home page. Its toys, crowd and class are slices of it, in
 * that order, so no animal appears twice on the page.
 */
export const HOME_CAST = cast(HOME_SEED, TOY_COUNT + CROWD_COUNT + CLASS_COUNT);

/** The animals of the toys, from the start of the cast. */
export const TOY_HERD = Arr.take(HOME_CAST, TOY_COUNT);

/** The friends of the crowd, straight after the toys. */
export const CROWD_HERD = Arr.take(Arr.drop(HOME_CAST, TOY_COUNT), CROWD_COUNT);

/** The animals of the class, at the end of the cast. */
export const CLASS_HERD = Arr.drop(HOME_CAST, TOY_COUNT + CROWD_COUNT);
