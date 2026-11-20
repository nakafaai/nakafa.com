import { growthOf } from "@repo/backend/confect/island/level";
import { EMPTY_TALLY } from "@repo/backend/confect/island/schema";
import type { Growth, OwnIsland } from "@repo/backend/confect/island/view";
import { seedOf } from "@/lib/island/noise";

/**
 * What the game and the home page open the learner's island with (ADR 0047,
 * D6 and D7): their level, the Stars that opened it and the next one, the side
 * of their footprint, the seed their terrain grows from, their edits with the
 * version those stand at, and the tally their medals read. A learner with no
 * island yet starts at level 1 with nothing changed and nothing counted; a learner with no account read yet grows the shared
 * seed until it is known. A page that reads only how far the learner grew (`island.queries.growth`) opens it with no
 * edits.
 */
export function entryOf(
  own: (typeof Growth.Type & Partial<typeof OwnIsland.Type>) | null | undefined,
  owner: string | undefined
) {
  const growth = growthOf(own?.lifetime ?? 0);
  return {
    edits: own?.world ?? [],
    from: growth.from,
    level: growth.level,
    lifetime: own?.lifetime ?? 0,
    next: growth.next,
    seed: seedOf(owner ?? "island"),
    size: growth.size,
    tally: own?.tally ?? EMPTY_TALLY,
    version: own?.version ?? 0,
  };
}
