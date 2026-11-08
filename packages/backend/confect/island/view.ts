import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Layout, paidFor } from "@repo/backend/confect/island/layout";
import { growthOf } from "@repo/backend/confect/island/level";
import { EarnedBadge, Visibility } from "@repo/backend/confect/island/schema";
import { MascotCode } from "@repo/mascot/code";
import { Schema } from "effect";

/**
 * What every reader of an island sees: its placements, level, badges, and the
 * IANA name of its owner's zone, which sets its hour (ADR 0042, D18).
 */
const islandFields = {
  badges: Schema.Array(EarnedBadge),
  layout: Layout,
  level: Schema.Finite,
  timeZone: Schema.String,
};

/** The owner's own island, with the Stars they can spend and who may visit it. */
export const OwnIsland = Schema.Struct({
  ...islandFields,
  lifetime: Schema.Finite,
  stars: Schema.Finite,
  version: Schema.Finite,
  visibility: Visibility,
});

/**
 * An island as a visitor sees it: no Stars, no ledger, nothing about a school
 * or a score (ADR 0042, D6). The owner shows as their username, name and animal.
 */
export const VisitedIsland = Schema.Struct({
  ...islandFields,
  mascot: MascotCode,
  name: Schema.String,
  username: Schema.String,
});

/** The fields both views take from the stored island. */
function shared(island: Docs["islands"]) {
  return {
    badges: island.badges,
    layout: island.layout,
    level: growthOf(island.lifetime).level,
    timeZone: island.timeZone.id,
  };
}

/** Projects the owner's island; spendable Stars are lifetime minus what the layout paid (D3). */
export function toOwnIsland(island: Docs["islands"]) {
  return {
    ...shared(island),
    lifetime: island.lifetime,
    stars: island.lifetime - paidFor(island.layout),
    version: island.version,
    visibility: island.visibility,
  };
}

/** Projects an island for a visitor, with its owner's public face. */
export function toVisitedIsland(
  island: Docs["islands"],
  owner: Pick<Docs["users"], "mascot" | "name">,
  username: string
) {
  return {
    ...shared(island),
    mascot: owner.mascot,
    name: owner.name,
    username,
  };
}
