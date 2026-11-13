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
  version: Schema.Finite,
  world: Edits,
});

/** Projects the stored island for its owner. */
export function toOwnIsland(island: Docs["islands"]) {
  return {
    badges: island.badges,
    lifetime: island.lifetime,
    version: island.version,
    world: island.world,
  };
}
