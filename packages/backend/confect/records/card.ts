import type { GenericId } from "@confect/core";
import type { ReportCardsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { gradeView } from "@repo/backend/confect/records/grade";
import {
  HashContent,
  type ReportSubject,
  type ReportView,
} from "@repo/backend/confect/records/report";
import { schemeOf } from "@repo/backend/confect/records/version";
import { sha256Hex } from "@repo/utilities/digest";
import { Array as Arr, Effect, Option, Order, Schema } from "effect";

/** The most grades one student holds in one period; every read of them takes this many. */
const GRADE_LIMIT = 100;

/** A report card as its readers see it, before its subject lines. */
export const reportView = (row: ReportCardsDoc): typeof ReportView.Type => ({
  approvedAt: row.approvedAt ?? null,
  hash: row.hash ?? null,
  id: row._id,
  note: row.note,
  state: row.state,
});

/** The report card of one student in one cohort, if the homeroom teacher has started one. */
export const reportOf = Effect.fn("records.card.of")(function* (
  cohortId: GenericId.GenericId<"tenantCohorts">,
  personId: GenericId.GenericId<"tenantPeople">
) {
  return yield* (yield* DatabaseReader)
    .table("reportCards")
    .get("by_cohortId_and_personId", cohortId, personId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
});

/**
 * The subject lines of a student's report: each released grade the student holds in a
 * class of the cohort in its period, judged by the scheme its entry named, in the order
 * of the class names. A draft grade is not on a report.
 */
export const releasedSubjects = Effect.fn("records.card.subjects")(function* (
  report: Pick<ReportCardsDoc, "cohortId" | "periodId" | "personId">
) {
  const reader = yield* DatabaseReader;
  const grades = yield* reader
    .table("classGrades")
    .index("by_personId_and_periodId", (query) =>
      query.eq("personId", report.personId).eq("periodId", report.periodId)
    )
    .take(GRADE_LIMIT)
    .pipe(Effect.orDie);
  const lines = yield* Effect.forEach(
    Arr.filter(grades, (grade) => grade.state === "released"),
    (grade) =>
      Effect.gen(function* () {
        const cls = yield* reader
          .table("classes")
          .get(grade.classId)
          .pipe(Effect.orDie);
        if (cls.cohortId !== report.cohortId) {
          return Option.none<typeof ReportSubject.Type>();
        }
        const view = gradeView(grade, yield* schemeOf(grade.schemeId));
        const line: typeof ReportSubject.Type = {
          ...(view.band === undefined ? {} : { band: view.band }),
          className: cls.name,
          kktp: view.kktp,
          value: view.value,
        };
        return Option.some(line);
      })
  );
  return Arr.sort(
    Arr.getSomes(lines),
    Order.mapInput(
      Order.String,
      (line: typeof ReportSubject.Type) => line.className
    )
  );
});

/** The JSON text of a report's content, its keys in the order of the schema's fields. */
const encodeContent = Schema.encodeEffect(Schema.fromJsonString(HashContent));

/**
 * The hash of a report's content: the SHA-256 of the report's ID, its student, its
 * subject lines, its note, and its approval time, as JSON text. The report's ID is in
 * the text, so the same grades of two students never share a hash, and nobody who knows
 * a student's grades can find the student's hash. The PDF and its QR code carry it.
 */
export const contentHash = Effect.fn("records.card.hash")(function* (
  content: typeof HashContent.Type
) {
  const text = yield* encodeContent(content);
  return yield* sha256Hex(text);
}, Effect.orDie);
