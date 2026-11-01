import type { ExamAttemptsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ResultSitting } from "@repo/backend/confect/exams/results/access";
import type { IntegrityRow } from "@repo/backend/confect/exams/results/contract";
import { Array as Arr, Effect, Option, Order, Record as Rec } from "effect";

/** The most finished attempts that one report reads. */
const REPORT_ATTEMPTS = 300;

/** The most signals of one attempt that a report counts, which keeps the whole read inside one query's limits. */
const ATTEMPT_SIGNALS = 80;

/** The most time away first, then the most exits, so the students a teacher may want to read lead the report. */
const mostAwayFirst = Order.combine(
  Order.mapInput(
    Order.Number,
    (row: typeof IntegrityRow.Type) => -row.awaySeconds
  ),
  Order.mapInput(Order.Number, (row: typeof IntegrityRow.Type) => -row.exits)
);

/**
 * One finished student as the report shows them, or none when they showed no signal. The exits and the time away
 * are the ones the attempt stored at its submission, which read all its signals, and the rest are counted here.
 */
const reportRow = Effect.fn("exams.results.integrity.row")(function* (
  attempt: ExamAttemptsDoc
) {
  const reader = yield* DatabaseReader;
  const signals = yield* reader
    .table("examSignals")
    .index("by_attemptId_and_at", (query) => query.eq("attempt", attempt._id))
    .take(ATTEMPT_SIGNALS)
    .pipe(Effect.orDie);
  const counted = (kind: (typeof signals)[number]["kind"]) =>
    Arr.filter(signals, (signal) => signal.kind === kind).length;
  const counts = {
    blur: counted("blur"),
    copy: counted("copy"),
    disconnect: counted("disconnect"),
    fullscreenExit: counted("fullscreenExit"),
    paste: counted("paste"),
    secondTab: counted("secondTab"),
  };
  const exits = attempt.integrity?.exits ?? 0;
  const showed =
    exits > 0 || Arr.some(Rec.values(counts), (count) => count > 0);
  if (!showed) {
    return Option.none();
  }
  const person = yield* reader
    .table("tenantPeople")
    .get(attempt.person)
    .pipe(Effect.orDie);
  return Option.some({
    ...counts,
    attemptId: attempt._id,
    awaySeconds: attempt.integrity?.awaySeconds ?? 0,
    exits,
    name: person.name,
  });
});

/**
 * The integrity report of a sitting after its exam (K25): the finished students who showed a signal, and how many
 * finished in all. It is an indication for a teacher to weigh, never a finding, so it decides nothing and no student
 * reads it. Outside the exam it knows only that a student left and for how long, never what they did there.
 */
export const integrityReport = Effect.fn("exams.results.integrity")(
  function* () {
    const sitting = yield* ResultSitting;
    const attempts = yield* (yield* DatabaseReader)
      .table("examAttempts")
      .index("by_sittingId_and_state_and_deadline", (query) =>
        query.eq("sitting", sitting._id).eq("state", "submitted")
      )
      .take(REPORT_ATTEMPTS)
      .pipe(Effect.orDie);
    const rows = yield* Effect.forEach(attempts, reportRow);
    return {
      rows: Arr.sort(Arr.getSomes(rows), mostAwayFirst),
      students: attempts.length,
    };
  }
);
