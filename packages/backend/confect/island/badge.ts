import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  type Badge,
  DAY_GRANTS,
  SubjectBadge,
} from "@repo/backend/confect/island/schema";
import {
  Array as Arr,
  DateTime,
  Effect,
  HashSet,
  Option,
  Schema,
} from "effect";

/** Explorer asks for grants on this many different days... */
const EXPLORER_DAYS = 7;
/** ...within this many days, today included. */
const EXPLORER_WINDOW = 10;
/** Try-out Fighter asks for this many finished sets. */
const FIGHTER_SETS = 10;
/** A subject badge asks for this many finished lessons of the subject. */
const SUBJECT_LESSONS = 10;

/** The fields of a ledger row that the badge rules read. */
type Grant = Pick<Docs["islandAwards"], "day" | "kind" | "subject" | "userId">;

/** Whether the owner earned grants on enough different days of the last ten. */
const exploredEnough = Effect.fn("island.badge.explored")(function* (
  grant: Grant
) {
  const database = yield* DatabaseReader;
  const from = DateTime.formatIsoDateUtc(
    DateTime.subtract(DateTime.makeUnsafe(grant.day), {
      days: EXPLORER_WINDOW - 1,
    })
  );
  const rows = yield* database
    .table("islandAwards")
    .index("by_userId_and_day", (query) =>
      query.eq("userId", grant.userId).gte("day", from)
    )
    .take(DAY_GRANTS * EXPLORER_WINDOW)
    .pipe(Effect.orDie);
  return (
    HashSet.size(HashSet.fromIterable(Arr.map(rows, (row) => row.day))) >=
    EXPLORER_DAYS
  );
});

/** Whether the owner finished enough try-out sets. */
const foughtEnough = Effect.fn("island.badge.fought")(function* (grant: Grant) {
  const database = yield* DatabaseReader;
  const sets = yield* database
    .table("islandAwards")
    .index("by_userId_and_kind", (query) =>
      query.eq("userId", grant.userId).eq("kind", "set")
    )
    .take(FIGHTER_SETS)
    .pipe(Effect.orDie);
  return sets.length >= FIGHTER_SETS;
});

/** Whether the owner finished enough lessons of the grant's subject. */
const studiedEnough = Effect.fn("island.badge.studied")(function* (
  grant: Grant,
  subject: typeof SubjectBadge.Type
) {
  const database = yield* DatabaseReader;
  const lessons = yield* database
    .table("islandAwards")
    .index("by_userId_and_subject", (query) =>
      query.eq("userId", grant.userId).eq("subject", subject)
    )
    .take(SUBJECT_LESSONS)
    .pipe(Effect.orDie);
  return lessons.length >= SUBJECT_LESSONS;
});

/**
 * The badges the grant just written completes, leaving out those the island
 * already holds. A rule reads the ledger only when this grant can change its
 * answer: Explorer on the day's first grant, Fighter on a set, a subject badge
 * on a lesson of that subject.
 */
export const completedBadges = Effect.fn("island.badge.completed")(function* (
  grant: Grant,
  firstOfDay: boolean,
  held: readonly Badge[]
) {
  const explorer = firstOfDay && (yield* exploredEnough(grant));
  const fighter = grant.kind === "set" && (yield* foughtEnough(grant));
  const subject = Schema.decodeUnknownOption(SubjectBadge)(grant.subject);
  const studied =
    Option.isSome(subject) && (yield* studiedEnough(grant, subject.value));
  const earned: readonly Badge[] = [
    ...(explorer ? ["explorer" as const] : []),
    ...(fighter ? ["fighter" as const] : []),
    ...(studied ? Option.toArray(subject) : []),
  ];
  return Arr.filter(earned, (badge) => !Arr.contains(held, badge));
});
