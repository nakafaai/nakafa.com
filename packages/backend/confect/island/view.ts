import type { Docs } from "@repo/backend/confect/_generated/docs";
import { EarnedBadge } from "@repo/backend/confect/island/schema";
import { Edits } from "@repo/backend/confect/island/world";
import { Schema } from "effect";

/**
 * The learner's own island as the game opens it (ADR 0047, D6 and D7): the
 * cells they changed and the version those edits stand at, their lifetime
 * Stars, from which `growthOf` reads the level and the footprint, and the
 * badges they earned.
 */
export const OwnIsland = Schema.Struct({
  badges: Schema.Array(EarnedBadge),
  lifetime: Schema.Finite,
  shared: Schema.Boolean,
  version: Schema.Finite,
  world: Edits,
});

/** Projects the stored island for its owner. */
export function toOwnIsland(island: Docs["islands"]) {
  return {
    badges: island.badges,
    lifetime: island.lifetime,
    shared: island.shared === true,
    version: island.version,
    world: island.world,
  };
}

/**
 * Another learner's island as a visitor sees it (ADR 0047, D18): its cells, the
 * lifetime Stars its level and footprint read from, its badges, and the owner
 * whose seed its terrain grows from. Nothing of the owner's account beyond
 * the address the visitor already knows.
 */
export const VisitedIsland = Schema.Struct({
  badges: Schema.Array(EarnedBadge),
  lifetime: Schema.Finite,
  owner: Schema.String,
  world: Edits,
});

/** Projects a shared island for its visitors. */
export function toVisitedIsland(island: Docs["islands"]) {
  return {
    badges: island.badges,
    lifetime: island.lifetime,
    owner: island.userId,
    world: island.world,
  };
}

/** One day of the learner's week: what they learned and the Stars it gave. */
const WeekDay = Schema.Struct({
  day: Schema.String,
  lessons: Schema.Int,
  sections: Schema.Int,
  sets: Schema.Int,
  stars: Schema.Finite,
});

/**
 * The learner's week as the home page tracks it: the seven days of this week
 * in their zone, Monday first, their run of days in a row, today, and the
 * week of try-outs that earns the Streak badge and its fountain (ADR 0047,
 * D19): the try-out days in a row so far, and whether the badge is held.
 */
export const Week = Schema.Struct({
  days: Schema.Array(WeekDay),
  rewarded: Schema.Boolean,
  streak: Schema.Int,
  today: Schema.String,
  tryouts: Schema.Int,
});
