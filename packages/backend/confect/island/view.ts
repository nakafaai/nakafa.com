import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  Layout,
  materialsFor,
  paidFor,
} from "@repo/backend/confect/island/layout";
import { growthOf } from "@repo/backend/confect/island/level";
import {
  lessMaterials,
  Materials,
} from "@repo/backend/confect/island/material";
import { EarnedBadge, Visibility } from "@repo/backend/confect/island/schema";
import { MascotCode } from "@repo/mascot/code";
import { Option, Schema } from "effect";

/**
 * What every reader of an island sees: its placements, level, badges, and the
 * IANA name of its owner's zone, which sets its hour (ADR 0042, D18).
 */
const islandFields = {
  badges: Schema.Array(EarnedBadge),
  layout: Layout,
  level: Schema.Finite,
  size: Schema.Finite,
  timeZone: Schema.String,
};

/**
 * The owner's own island, with the Stars and materials they can spend, who may
 * visit it, and the last days they learned and watered, which decide whether
 * the garden can be watered today (ADR 0042, D13).
 */
export const OwnIsland = Schema.Struct({
  ...islandFields,
  learned: Schema.optionalKey(Schema.String),
  lifetime: Schema.Finite,
  materials: Materials,
  stars: Schema.Finite,
  version: Schema.Finite,
  visibility: Visibility,
  watered: Schema.optionalKey(Schema.String),
});

/**
 * An island as a visitor sees it: no Stars, no ledger, nothing about a school
 * or a score (ADR 0042, D6). The owner shows as their username, name and animal.
 */
export const VisitedIsland = Schema.Struct({
  ...islandFields,
  mascot: MascotCode,
  name: Schema.String,
  /** The signed address of the picture its owner last shared, the visit's OpenGraph image (D20). */
  snapshot: Schema.optionalKey(Schema.String),
  username: Schema.String,
});

/** The fields both views take from the stored island. */
function shared(island: Docs["islands"]) {
  const growth = growthOf(island.lifetime);
  return {
    badges: island.badges,
    layout: island.layout,
    level: growth.level,
    size: growth.size,
    timeZone: island.timeZone.id,
  };
}

/**
 * What the owner can spend: Stars are lifetime minus what the layout paid (D3),
 * and materials are every harvest minus what the layout's stages cost (D13).
 */
export function spendableOf(
  island: Pick<Docs["islands"], "harvested" | "layout" | "lifetime">
) {
  return {
    materials: lessMaterials(island.harvested, materialsFor(island.layout)),
    stars: island.lifetime - paidFor(island.layout),
  };
}

/** Projects the owner's island, with the last days they learned and watered when there are any. */
export function toOwnIsland(island: Docs["islands"]) {
  return {
    ...shared(island),
    ...(island.learned === undefined ? {} : { learned: island.learned }),
    ...spendableOf(island),
    lifetime: island.lifetime,
    version: island.version,
    visibility: island.visibility,
    ...(island.watered === undefined ? {} : { watered: island.watered }),
  };
}

/** Projects an island for a visitor, with its owner's public face and the address of its snapshot when it has one. */
export function toVisitedIsland(
  island: Docs["islands"],
  owner: Pick<Docs["users"], "mascot" | "name">,
  username: string,
  snapshot: Option.Option<string>
) {
  return {
    ...shared(island),
    mascot: owner.mascot,
    name: owner.name,
    ...Option.match(snapshot, {
      onNone: () => ({}),
      onSome: (address) => ({ snapshot: address }),
    }),
    username,
  };
}
