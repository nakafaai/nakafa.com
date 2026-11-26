import { Tally } from "@repo/backend/confect/progress/schema";
import { MascotCode } from "@repo/mascot/code";
import { Schema } from "effect";

/**
 * How far the signed-in learner has grown: their lifetime Stars, from which
 * `growthOf` reads the level, and their tally, from which every medal is read.
 */
export const Growth = Schema.Struct({
  lifetime: Schema.Finite,
  tally: Tally,
});

/**
 * A learner's medals as their profile shows them to whoever may open it: their
 * level, and the tally every medal is read from.
 */
export const Medals = Schema.Struct({ level: Schema.Int, tally: Tally });

/**
 * What a learner already holds of one try-out set's Stars: the set's own grant,
 * the keys of the sections whose grant they hold, and the Stars those grants gave.
 */
export const SetClaims = Schema.Struct({
  sections: Schema.Array(Schema.String),
  set: Schema.Boolean,
  stars: Schema.Finite,
});

/**
 * One row of the global leaderboard: a learner by their first name and mascot,
 * their level and lifetime Stars, their profile username when the viewer may
 * open it, whether the row is the viewer's own, and its place.
 */
export const Leader = Schema.Struct({
  level: Schema.Int,
  lifetime: Schema.Finite,
  mascot: MascotCode,
  name: Schema.String,
  own: Schema.Boolean,
  /** The row's place on the board, from 1. */
  place: Schema.Int,
  /** The learner's profile username when accessible to the viewer, else null. */
  username: Schema.NullOr(Schema.String),
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
