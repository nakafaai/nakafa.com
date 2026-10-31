import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { classNameKey } from "@repo/backend/confect/classroom/class";
import { gradeView, ReleasedGrade } from "@repo/backend/confect/records/grade";
import { schemeOf } from "@repo/backend/confect/records/version";
import type { GenericId } from "convex/values";
import { Array as Arr, Effect, Order, Schema, Struct } from "effect";

/** The most grades of one student that a read takes: a class a period for twelve years, two periods a year, with room. */
const GRADE_LIMIT = 200;

/** A released grade with its period's first day, which orders the grades and leaves the server without it. */
const DatedGrade = Schema.Struct({
  ...ReleasedGrade.fields,
  start: Schema.String,
});

/** The order the pages show a student's grades in: the newest period first, then each class by its name. */
const byPeriodThenClass = Order.combine(
  Order.flip(
    Order.mapInput(Order.String, (grade: typeof DatedGrade.Type) => grade.start)
  ),
  Order.mapInput(Order.String, (grade: typeof DatedGrade.Type) =>
    classNameKey(grade.className)
  )
);

/**
 * The released grades of one student, at most GRADE_LIMIT of them, newest period first. A draft never leaves the
 * server, and each grade is judged by the scheme its entry named.
 */
export const releasedGradesOf = Effect.fn("records.grades.released")(function* (
  personId: GenericId<"tenantPeople">
) {
  const reader = yield* DatabaseReader;
  const rows = yield* reader
    .table("classGrades")
    .index("by_personId_and_periodId", (query) =>
      query.eq("personId", personId)
    )
    .take(GRADE_LIMIT)
    .pipe(Effect.orDie);
  const grades = yield* Effect.forEach(
    Arr.filter(rows, (row) => row.state === "released"),
    (row) =>
      Effect.gen(function* () {
        const cls = yield* reader
          .table("classes")
          .get(row.classId)
          .pipe(Effect.orDie);
        const period = yield* reader
          .table("tenantPeriods")
          .get(row.periodId)
          .pipe(Effect.orDie);
        const view = gradeView(row, yield* schemeOf(row.schemeId));
        return {
          ...(view.band === undefined ? {} : { band: view.band }),
          className: cls.name,
          id: view.id,
          kktp: view.kktp,
          period: period.name,
          start: period.start,
          value: view.value,
        };
      })
  );
  return Arr.map(Arr.sort(grades, byPeriodThenClass), (grade) =>
    Struct.omit(grade, ["start"])
  );
});
