import { Option, Record, Schema } from "effect";

/**
 * The learning that grants Stars, one member per kind (ADR 0042, D8). Latihan
 * adds its kinds here and in `AWARD_RULES`, and nothing else changes.
 */
export const AwardSource = Schema.Union([
  /** A lesson read to its end; its subject is the lesson's material domain. */
  Schema.TaggedStruct("lesson", {
    content: Schema.String,
    subject: Schema.String,
  }),
  /** A try-out section closed with at least one answer. */
  Schema.TaggedStruct("section", {
    section: Schema.String,
    set: Schema.String,
  }),
  /** A try-out set whose last section closed. */
  Schema.TaggedStruct("set", { set: Schema.String }),
]);
export type AwardSource = typeof AwardSource.Type;

/** What one kind grants, and how many of it one day may grant, none for no count. */
const AwardRule = Schema.Struct({
  daily: Schema.Option(Schema.Finite),
  stars: Schema.Finite,
});

/** The rule of each kind (ADR 0042, D8). */
export const AWARD_RULES = {
  lesson: { daily: Option.some(6), stars: 5 },
  section: { daily: Option.none(), stars: 15 },
  set: { daily: Option.none(), stars: 40 },
} satisfies Record<AwardSource["_tag"], typeof AwardRule.Type>;

/** The kinds of grant a ledger row records. */
export const AwardKind = Schema.Literals(Record.keys(AWARD_RULES));

/** The most Stars one day grants, whatever the kinds. */
export const DAILY_STARS = 150;

/** The most grants one day can hold: each gives at least one of the day's Stars. */
export const DAY_GRANTS = DAILY_STARS;

/**
 * What an island has counted of its owner's learning (ADR 0047, D30): the days
 * they learned on, their longest run of days in a row, the lessons, try-out
 * sections and try-out sets they finished, and the lessons of each subject by
 * its material domain. Every badge reads one of these counts, so a grant adds
 * to them and never reads the ledger back.
 */
export const Tally = Schema.Struct({
  days: Schema.Int,
  lessons: Schema.Int,
  sections: Schema.Int,
  sets: Schema.Int,
  streak: Schema.Int,
  subjects: Schema.Record(Schema.String, Schema.Int),
});

/** The tally of an island that has counted nothing yet. */
export const EMPTY_TALLY: typeof Tally.Type = {
  days: 0,
  lessons: 0,
  sections: 0,
  sets: 0,
  streak: 0,
  subjects: {},
};

/**
 * One badge: the count it stands for, named as a kind of learning or as a
 * subject's material domain, and the tier of it the learner reached, from 1.
 */
export const Badge = Schema.Struct({ name: Schema.String, tier: Schema.Int });

/** A grant that wrote its row: the Stars it gave and the badge tiers it reached. */
export const Granted = Schema.TaggedStruct("granted", {
  badges: Schema.Array(Badge),
  stars: Schema.Finite,
});
/** A grant whose key the learner already holds. */
export const Duplicate = Schema.TaggedStruct("duplicate", {});
/** A grant refused by the day's count for its kind or the day's Stars. */
export const Capped = Schema.TaggedStruct("capped", {});

/**
 * A build made against older edits than the island holds, which another tab or
 * device changed meanwhile (ADR 0047, D6). The browser reloads the island and
 * the learner goes on from there.
 */
export class IslandStale extends Schema.TaggedError<
  IslandStale,
  { readonly brand: unique symbol }
>()("IslandStale", { version: Schema.Int }) {}
