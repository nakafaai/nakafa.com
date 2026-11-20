import { growthOf } from "@repo/backend/confect/island/level";
import { EMPTY_TALLY } from "@repo/backend/confect/island/schema";
import type { Growth, OwnIsland } from "@repo/backend/confect/island/view";

/** What a world's seed is made from before its learner's account is read. */
const SHARED = "island";

/**
 * What the game and the home page open the learner's world with (ADR 0050,
 * W1 and W5): their level, the Stars that opened it and the next one, the
 * blueprints they opened and the Stars they have left for more, what their
 * land's seed is made from, and the tally their medals read. A learner with
 * no island yet starts at level 1 with nothing opened and nothing counted; a
 * learner whose account is not read yet grows the shared seed until it is. A page that
 * reads only how far the learner grew (`island.queries.growth`) opens it with
 * nothing opened.
 */
export function entryOf(
  own: (typeof Growth.Type & Partial<typeof OwnIsland.Type>) | null | undefined,
  owner: string | undefined
) {
  const growth = growthOf(own?.lifetime ?? 0);
  return {
    balance: own?.balance ?? 0,
    blueprints: own?.blueprints ?? [],
    from: growth.from,
    level: growth.level,
    lifetime: own?.lifetime ?? 0,
    next: growth.next,
    owner: owner ?? SHARED,
    tally: own?.tally ?? EMPTY_TALLY,
  };
}
