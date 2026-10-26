import type { GenericId } from "@confect/core";
import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Authority } from "@repo/backend/confect/access/policy";
import {
  classMemberOf,
  placeClass,
  subjectTeacherOf,
} from "@repo/backend/confect/classroom/authority";
import {
  Grade,
  GradeAccess,
  Report,
  ReportAccess,
} from "@repo/backend/confect/records/access";
import { gradeKind, reportKind } from "@repo/backend/confect/records/kinds";
import {
  activeHomeroomOf,
  cohortLocked,
} from "@repo/backend/confect/tenancy/authority";
import { Effect, Option } from "effect";

/** Reads the class a grade names; a grade always names one, so a missing one is a defect. */
const readClass = Effect.fnUntraced(function* (
  classId: GenericId.GenericId<"classes">
) {
  return yield* (yield* DatabaseReader)
    .table("classes")
    .get(classId)
    .pipe(Effect.orDie);
});

/**
 * A grade sits where its class sits. `classMember` holds only for the student of
 * the grade, and only once it is released and the student is placed in the class's
 * cohort: a classmate's grade and a draft stay closed to a student. `subjectTeacher`
 * holds for the teachers of the class, drafts included.
 */
export const gradeAuthority = Authority.make(
  gradeKind,
  Authority.load(gradeKind),
  {
    place: (row) => readClass(row.classId).pipe(Effect.flatMap(placeClass)),
    relations: {
      classMember: (row, member) =>
        row.personId === member.person._id && row.state === "released"
          ? readClass(row.classId).pipe(
              Effect.flatMap((cls) => classMemberOf(cls, member))
            )
          : Effect.succeed(false),
      subjectTeacher: (row, member) =>
        readClass(row.classId).pipe(
          Effect.flatMap((cls) => subjectTeacherOf(cls, member))
        ),
    },
    tenantOf: (row) => row.tenantId,
  }
);

/** Checks a grade action on the grade its access spec names, and provides the loaded grade to the function. */
export const gradeAccess = MiddlewareImpl.make(
  databaseSchema,
  GradeAccess,
  gradeAuthority.middleware(Grade)
);

/** Where a cohort sits: its unit, locked once it, its period, or its unit is archived. */
const placeCohort = Effect.fnUntraced(function* (
  cohortId: GenericId.GenericId<"tenantCohorts">
) {
  const reader = yield* DatabaseReader;
  const cohortRow = yield* reader
    .table("tenantCohorts")
    .get(cohortId)
    .pipe(Effect.orDie);
  const [periodRow, unitRow] = yield* Effect.all([
    reader.table("tenantPeriods").get(cohortRow.periodId).pipe(Effect.orDie),
    reader.table("tenantUnits").get(cohortRow.unitId).pipe(Effect.orDie),
  ]);
  return {
    locked: cohortLocked(cohortRow, periodRow, unitRow),
    units: [cohortRow.unitId],
  };
});

/**
 * A report card sits where its cohort sits. `homeroom` holds for the cohort's active
 * homeroom teacher, who writes its reports; the principal and the Admin hold roles.
 */
export const reportAuthority = Authority.make(
  reportKind,
  Authority.load(reportKind),
  {
    place: (row) => placeCohort(row.cohortId),
    relations: {
      homeroom: (row, member) =>
        activeHomeroomOf(row.cohortId).pipe(
          Effect.map((assignment) =>
            Option.exists(
              assignment,
              (found) => found.personId === member.person._id
            )
          )
        ),
    },
    tenantOf: (row) => row.tenantId,
  }
);

/** Checks a report action on the report card its access spec names, and provides the loaded report to the function. */
export const reportAccess = MiddlewareImpl.make(
  databaseSchema,
  ReportAccess,
  reportAuthority.middleware(Report)
);
