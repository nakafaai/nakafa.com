import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Tally } from "@repo/backend/confect/island/schema";
import { Edits } from "@repo/backend/confect/island/world";
import { MascotCode } from "@repo/mascot/code";
import { Schema } from "effect";

/**
 * The learner's own island as the game opens it (ADR 0047, D6 and D7): the
 * cells they changed and the version those edits stand at, their lifetime
 * Stars, from which `growthOf` reads the level and the footprint, and their
 * tally, from which `countsOf` reads every badge.
 */
export const OwnIsland = Schema.Struct({
  lifetime: Schema.Finite,
  tally: Tally,
  version: Schema.Finite,
  world: Edits,
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

/** Projects the stored island for its owner. */
export function toOwnIsland(island: Docs["islands"]) {
  return {
    lifetime: island.lifetime,
    tally: island.tally,
    version: island.version,
    world: island.world,
  };
}

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
