import type { Ref } from "@confect/core";
import type island from "@repo/backend/confect/_generated/refs/island";
import { growthOf } from "@repo/backend/confect/island/level";
import { EMPTY_TALLY } from "@repo/backend/confect/island/schema";
import { seedOf } from "@/lib/island/noise";

/**
 * What the game and the home page open the learner's island with (ADR 0047,
 * D6 and D7): their level, the Stars that opened it and the next one, the side
 * of their footprint, the seed their terrain grows from, their edits with the
 * version those stand at, and the tally their medals read. A learner with no
 * island yet starts at level 1 with nothing changed and nothing counted; a learner with no account read yet grows the shared
 * seed until it is known.
 */
export function entryOf(
  own: Ref.Returns<typeof island.queries.own> | undefined,
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
