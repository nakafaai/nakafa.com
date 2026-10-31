import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type {
  Transcript,
  TranscriptLine,
} from "@repo/backend/confect/records/letter";
import type { ReportSubject } from "@repo/backend/confect/records/report";
import { Array as Arr, Effect, Option, Order, Record } from "effect";

/**
 * The most report cards one student holds, in every unit of the school: one per class group
 * a period, and a level runs at most seven years of two periods. Every read of them takes this many.
 */
const REPORT_LIMIT = 40;

/** Millionths of a value: every value is summed in them, so no binary fraction moves a rounding. */
const MILLIONTHS = 1_000_000;
/** The millionths of one hundredth, the step a transcript value is rounded to. */
const STEP = MILLIONTHS / 100;

/**
 * The mean of values on the 0 to 100 scale, rounded half up to two decimals (Kepmendikdasmen
 * 177/2026, Lampiran II B.6: 72,495 becomes 72,50 and 85,754 becomes 85,75). The sum and the
 * rounding run on whole millionths, so the result is exact.
 */
export const meanOf = (values: Arr.NonEmptyReadonlyArray<number>) => {
  const sum = Arr.reduce(
    Arr.map(values, (value) => Math.round(value * MILLIONTHS)),
    0,
    (a, b) => a + b
  );
  const count = values.length;
  return Math.floor((2 * sum + count * STEP) / (2 * count * STEP)) / 100;
};

/** The subject a report line counts under: its class's subject, or its class name when it has none. */
const subjectOf = (line: typeof ReportSubject.Type) =>
  line.subject ?? line.className;

/**
 * The transcript of report lines, the oldest report first: one line per subject, compared
 * without regard to case and named as the newest report names it, each the mean of its
 * values, in the order of the names; and the mean of those values. No line gives none.
 */
export const transcriptOfLines = (
  lines: readonly (typeof ReportSubject.Type)[]
): Option.Option<typeof Transcript.Type> => {
  const groups = Arr.groupBy(lines, (line) => subjectOf(line).toLowerCase());
  const subjects = Arr.sort(
    Arr.map(Record.values(groups), (group): typeof TranscriptLine.Type => ({
      subject: subjectOf(Arr.lastNonEmpty(group)),
      value: meanOf(Arr.map(group, (line) => line.value)),
    })),
    Order.mapInput(Order.String, (line: typeof TranscriptLine.Type) =>
      line.subject.toLowerCase()
    )
  );
  return Option.map(
    Arr.match(subjects, {
      onEmpty: Option.none,
      onNonEmpty: Option.some,
    }),
    (nonEmpty) => ({
      average: meanOf(Arr.map(nonEmpty, (line) => line.value)),
      subjects: nonEmpty,
    })
  );
};

/**
 * A student's transcript data in one unit (ADR 0033, S6): the subject lines of every locked
 * report card the student holds in a class group of the unit, oldest first as the index keeps
 * them, as `transcriptOfLines` counts them. A student without a locked report card has none.
 */
export const transcriptOf = Effect.fn("records.transcript.of")(function* (
  personId: GenericId.GenericId<"tenantPeople">,
  unitId: GenericId.GenericId<"tenantUnits">
) {
  const reader = yield* DatabaseReader;
  const reports = yield* reader
    .table("reportCards")
    .index("by_personId_and_state", (query) =>
      query.eq("personId", personId).eq("state", "locked")
    )
    .take(REPORT_LIMIT)
    .pipe(Effect.orDie);
  const inUnit = yield* Effect.filter(reports, (report) =>
    reader
      .table("tenantCohorts")
      .get(report.cohortId)
      .pipe(
        Effect.orDie,
        Effect.map((cohort) => cohort.unitId === unitId)
      )
  );
  // A locked report always holds the copy of its subject lines taken at approval.
  return transcriptOfLines(
    Arr.flatten(
      Arr.getSomes(
        Arr.map(inUnit, (report) => Option.fromUndefinedOr(report.subjects))
      )
    )
  );
});
