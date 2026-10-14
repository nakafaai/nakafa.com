import { cast } from "@repo/mascot/seed";

/** The seed that names the animals of the home page. */
const HOME_SEED = "nakafa-home";

/**
 * Up to `count` animals of the home page, from `skip` on in the one cast of the
 * page. Each part takes its own slice of the cast, so no animal appears twice.
 */
export function homeHerd(count: number, skip: number) {
  return cast(HOME_SEED, count, skip);
}
