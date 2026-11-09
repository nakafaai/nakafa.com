import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  runBack,
  TRYOUT_KINDS,
  tryoutDays,
} from "@repo/backend/confect/island/run";
import {
  type Badge,
  DAY_GRANTS,
  SubjectBadge,
} from "@repo/backend/confect/island/schema";
import { STREAK_DAYS } from "@repo/backend/confect/island/week";
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
    .index("by_userId_and_kind_and_day", (query) =>
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

/** Whether the owner tried a try-out on each of the last seven days, the grant's own day included. */
const triedEnough = Effect.fn("island.badge.tried")(function* (grant: Grant) {
  const days = yield* tryoutDays(grant.userId, grant.day);
  return runBack(days, grant.day) >= STREAK_DAYS;
});

/** Whether a grant is a try-out's: a closed section or a finished set. */
function isTryout(grant: Pick<Grant, "kind">) {
  return Arr.contains(TRYOUT_KINDS, grant.kind);
}

/**
 * The badges the grant just written completes, leaving out those the island
 * already holds. `before` is what the day held before this grant. A rule
 * reads the ledger only when this grant can change its answer: Explorer on
 * the day's first grant, Fighter on a set, Streak on the day's first try-out
 * while it is not held, a subject badge on a lesson of that subject.
 */
export const completedBadges = Effect.fn("island.badge.completed")(function* (
  grant: Grant,
  before: readonly Pick<Grant, "kind">[],
  held: readonly Badge[]
) {
  const explorer = before.length === 0 && (yield* exploredEnough(grant));
  const fighter = grant.kind === "set" && (yield* foughtEnough(grant));
  const streak =
    isTryout(grant) &&
    !Arr.some(before, isTryout) &&
    !Arr.contains(held, "streak") &&
    (yield* triedEnough(grant));
  const subject = Schema.decodeUnknownOption(SubjectBadge)(grant.subject);
  const studied =
    Option.isSome(subject) && (yield* studiedEnough(grant, subject.value));
  const earned: readonly Badge[] = [
    ...(explorer ? ["explorer" as const] : []),
    ...(fighter ? ["fighter" as const] : []),
    ...(streak ? ["streak" as const] : []),
    ...(studied ? Option.toArray(subject) : []),
  ];
  return Arr.filter(earned, (badge) => !Arr.contains(held, badge));
});
