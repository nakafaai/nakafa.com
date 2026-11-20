import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Across, Chunk } from "@repo/backend/confect/island/chunk";
import {
  Access,
  FIRST_ACCESS,
  Sticker,
  Tally,
} from "@repo/backend/confect/island/schema";
import { balanceOf, Thing } from "@repo/backend/confect/island/things";
import { MascotCode } from "@repo/mascot/code";
import { Schema } from "effect";

/**
 * The learner's own island as the game opens it (ADR 0050, W5 and W6): who
 * their world opens to, the blueprints they opened and the Stars left to open
 * more, their lifetime Stars, from which `growthOf` reads the level, and their
 * tally, from which `countsOf` reads every badge.
 */
export const OwnIsland = Schema.Struct({
  access: Access,
  balance: Schema.Finite,
  blueprints: Schema.Array(Thing),
  lifetime: Schema.Finite,
  tally: Tally,
});

/**
 * How far the signed-in learner has grown, without the world they built: their lifetime Stars, from
 * which `growthOf` reads the level, and their tally, from which every medal is read. A try-out pane
 * reads it to show the level and the medals a set moves.
 */
export const Growth = Schema.Struct({
  lifetime: Schema.Finite,
  tally: Tally,
});

/**
 * A learner's medals as their profile shows them to whoever may open it (ADR
 * 0047, D30): their level, and the tally every medal is read from.
 */
export const Medals = Schema.Struct({ level: Schema.Int, tally: Tally });

/**
 * What a learner already holds of one try-out set's Stars: the set's own grant, the keys of the
 * sections whose grant they hold, and the Stars those grants gave.
 */
export const SetClaims = Schema.Struct({
  sections: Schema.Array(Schema.String),
  set: Schema.Boolean,
  stars: Schema.Finite,
});

/** Projects the stored island for its owner; a field never written reads as its first value. */
export function toOwnIsland(island: Docs["islands"]) {
  const blueprints = island.blueprints ?? [];
  return {
    access: island.access ?? FIRST_ACCESS,
    balance: balanceOf(island.lifetime, blueprints),
    blueprints,
    lifetime: island.lifetime,
    tally: island.tally,
  };
}

/** One changed chunk of a world as the browser lays it over the generated land (ADR 0050, W3). */
export const Changed = Schema.Struct({
  ...Chunk.fields,
  cx: Across,
  cz: Across,
});

/**
 * What a visitor needs to open a world (ADR 0050, W6): who it opens to, its
 * owner by their first name, mascot and level, the owner's id, which the
 * browser turns into the land's seed, and whether the viewer is that owner.
 */
export const Visit = Schema.Struct({
  access: Access,
  level: Schema.Int,
  mascot: MascotCode,
  name: Schema.String,
  own: Schema.Boolean,
  owner: Schema.String,
});

/** One row of a guest book: who came, by first name and mascot, their sticker, and when. */
export const Guest = Schema.Struct({
  at: Schema.Finite,
  mascot: MascotCode,
  name: Schema.String,
  sticker: Sticker,
});

/**
 * One row of the global leaderboard (ADR 0047, D27): a learner by their first
 * name and mascot, their level and lifetime Stars, whether the row is the
 * viewer's own, and its place.
 */
export const Leader = Schema.Struct({
  level: Schema.Int,
  lifetime: Schema.Finite,
  mascot: MascotCode,
  name: Schema.String,
  own: Schema.Boolean,
  /** The row's place on the board, from 1. */
  place: Schema.Int,
});

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
 * in their zone, Monday first, their run of days in a row, and today.
 */
export const Week = Schema.Struct({
  days: Schema.Array(WeekDay),
  streak: Schema.Int,
  today: Schema.String,
});
