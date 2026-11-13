import type { Ref } from "@confect/core";
import type island from "@repo/backend/confect/_generated/refs/island";
import { growthOf } from "@repo/backend/confect/island/level";
import { Option } from "effect";
import { seedOf } from "@/lib/island/noise";

/**
 * What the game and the home page open the learner's island with (ADR 0047,
 * D6 and D7): their level, the Stars that opened it and the next one, the side
 * of their footprint, the seed their terrain grows from, and their edits with
 * the version those stand at. A learner with no island yet starts at level 1
 * with nothing changed; a learner with no account read yet grows the shared
 * seed until it is known.
 */
export function entryOf(
  own: Ref.Returns<typeof island.queries.own> | undefined,
  owner: string | undefined
) {
  const growth = growthOf(own?.lifetime ?? 0);
  return {
    badges: own?.badges ?? [],
    edits: own?.world ?? [],
    from: growth.from,
    level: growth.level,
    lifetime: own?.lifetime ?? 0,
    next: Option.getOrUndefined(growth.next),
    seed: seedOf(owner ?? "island"),
    size: growth.size,
    version: own?.version ?? 0,
  };
}
