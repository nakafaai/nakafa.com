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

/** The subjects whose finished lessons earn a badge, named as their material domain. */
export const SubjectBadge = Schema.Literals([
  "mathematics",
  "physics",
  "chemistry",
  "biology",
]);

/** Every badge an island can earn (ADR 0042, D11). */
export const Badge = Schema.Literals([
  "explorer",
  "fighter",
  ...SubjectBadge.literals,
]);
export type Badge = typeof Badge.Type;

/** A badge on an island and the moment it was earned. */
export const EarnedBadge = Schema.Struct({ at: Schema.Finite, badge: Badge });

/** A grant that wrote its row: the Stars it gave and the badges it completed. */
export const Granted = Schema.TaggedStruct("granted", {
  badges: Schema.Array(Badge),
  stars: Schema.Finite,
});
/** A grant whose key the learner already holds. */
export const Duplicate = Schema.TaggedStruct("duplicate", {});
/** A grant refused by the day's count for its kind or the day's Stars. */
export const Capped = Schema.TaggedStruct("capped", {});

/** Who may visit an island: only its owner, anyone with its link, or everyone. */
export const Visibility = Schema.Literals(["private", "link", "public"]);

/**
 * An edit made against an older layout than the island holds, which another tab
 * or device changed meanwhile (ADR 0042, D4). The browser reloads the island and
 * the owner tries again.
 */
export class IslandStale extends Schema.TaggedError<
  IslandStale,
  { readonly brand: unique symbol }
>()("IslandStale", { version: Schema.Int }) {}

/**
 * Why the garden refused a watering or a harvest (ADR 0042, D13): the owner has
 * not learned today, already watered today, has no plant there or anywhere,
 * nothing stands there, or the plant has not grown to its last stage.
 */
export class FarmRefused extends Schema.TaggedError<
  FarmRefused,
  { readonly brand: unique symbol }
>()("FarmRefused", {
  reason: Schema.Literals([
    "barren",
    "missing",
    "unlearned",
    "unripe",
    "watered",
  ]),
}) {}
