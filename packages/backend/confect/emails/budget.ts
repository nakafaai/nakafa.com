import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { DateTime, Effect, Option } from "effect";

/**
 * The notice mails one day sends, digests and try-out reminders together. Resend's free plan takes 100 emails a day,
 * and these keep 20 for what is always sent, an invitation, a sign-in code, a welcome, so a burst of notices never
 * holds an invitation back.
 */
export const DAILY_LIMIT = 80;

/** Today's count of notice mails on the UTC calendar, how many the day still takes, and the row that holds it. */
export const readMailBudget = Effect.fn("emails.budget.read")(function* (
  now: number
) {
  const day = DateTime.formatIsoDateUtc(DateTime.makeUnsafe(now));
  const row = yield* (yield* DatabaseReader)
    .table("noticeMailBudget")
    .index("by_creation_time")
    .first()
    .pipe(Effect.orDie);
  const sent = Option.match(row, {
    onNone: () => 0,
    onSome: (found) => (found.day === day ? found.sent : 0),
  });
  return { day, left: DAILY_LIMIT - sent, row, sent };
});

/** Counts mails against the day's budget, in the one row a new day takes over. */
export const spendMailBudget = Effect.fn("emails.budget.spend")(function* (
  budget: Effect.Success<ReturnType<typeof readMailBudget>>,
  count: number
) {
  const writer = yield* DatabaseWriter;
  const spent = { day: budget.day, sent: budget.sent + count };
  yield* Option.match(budget.row, {
    onNone: () => writer.table("noticeMailBudget").insert(spent),
    onSome: (row) => writer.table("noticeMailBudget").patch(row._id, spent),
  }).pipe(Effect.orDie);
});
