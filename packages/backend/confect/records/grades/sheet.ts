import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { type GradeLine, gradeView } from "@repo/backend/confect/records/grade";
import spec from "@repo/backend/confect/records/grades.spec";
import {
  schemeForEntry,
  schemeOf,
} from "@repo/backend/confect/records/version";
import { Effect, Option, Struct } from "effect";

/**
 * One page of a class's gradebook: each student placed in the class's cohort, in the
 * order of their placement, with the grade the student holds in the class, a draft or
 * a released one, or none yet. A subject teacher reads it, so drafts are included
 * (ADR 0033, S2). Each grade is judged by the scheme its entry named.
 */
export const sheet = FunctionImpl.make(
  databaseSchema,
  spec,
  "sheet",
  Effect.fn("records.grades.sheet")(function* ({ paginationOpts }) {
    const row = yield* Class;
    const reader = yield* DatabaseReader;
    const page = yield* reader
      .table("tenantCohortMembers")
      .index("by_cohortId_and_personId", (query) =>
        query.eq("cohortId", row.cohortId)
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const lines = yield* Effect.forEach(
      page.page,
      (placement) =>
        Effect.gen(function* () {
          const person = yield* reader
            .table("tenantPeople")
            .get(placement.personId)
            .pipe(Effect.orDie);
          const grade = yield* reader
            .table("classGrades")
            .get("by_classId_and_personId", row._id, placement.personId)
            .pipe(
              Effect.asSome,
              Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
              Effect.orDie
            );
          const view = yield* Effect.transposeOption(
            Option.map(grade, (found) =>
              Effect.map(schemeOf(found.schemeId), (judging) =>
                gradeView(found, judging)
              )
            )
          );
          const line: typeof GradeLine.Type = {
            grade: Option.getOrNull(view),
            student: { id: person._id, name: person.name },
          };
          return line;
        }),
      { concurrency: "unbounded" }
    );
    return Struct.assign(page, { page: lines });
  })
);

/** The scheme the class's next entry is judged by, which the gradebook judges a typed value with. */
export const scheme = FunctionImpl.make(
  databaseSchema,
  spec,
  "scheme",
  Effect.fn("records.grades.scheme")(function* () {
    const row = yield* Class;
    return yield* schemeForEntry(row.tenantId);
  })
);
