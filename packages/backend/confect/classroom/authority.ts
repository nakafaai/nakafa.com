import type { GenericId } from "@confect/core";
import { MiddlewareImpl } from "@confect/server";
import type { ClassesDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Authority } from "@repo/backend/confect/access/policy";
import { Class, ClassAccess } from "@repo/backend/confect/classroom/access";
import { classKind } from "@repo/backend/confect/classroom/kinds";
import {
  teacherAssignment,
  teachesUnit,
} from "@repo/backend/confect/classroom/teacher";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import {
  cohortLocked,
  placementOf,
} from "@repo/backend/confect/tenancy/authority";
import { Effect, Option } from "effect";

/** Reads the cohort a class names; a class always names one, so a missing one is a defect. */
const readCohort = Effect.fnUntraced(function* (
  cohortId: GenericId.GenericId<"tenantCohorts">
) {
  return yield* (yield* DatabaseReader)
    .table("tenantCohorts")
    .get(cohortId)
    .pipe(Effect.orDie);
});

/** Reads the period a class names; a missing one is a defect. */
const readPeriod = Effect.fnUntraced(function* (
  periodId: GenericId.GenericId<"tenantPeriods">
) {
  return yield* (yield* DatabaseReader)
    .table("tenantPeriods")
    .get(periodId)
    .pipe(Effect.orDie);
});

/** Reads the unit a class names; a missing one is a defect. */
const readUnit = Effect.fnUntraced(function* (
  unitId: GenericId.GenericId<"tenantUnits">
) {
  return yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .get(unitId)
    .pipe(Effect.orDie);
});

/**
 * Where a class sits: it is locked once it, its cohort, its period, or its unit
 * is archived, and its unit's grants cover it. Grades of the class sit in the
 * same place.
 */
export const placeClass = (row: ClassesDoc) =>
  Effect.all({
    cohort: readCohort(row.cohortId),
    period: readPeriod(row.periodId),
    unit: readUnit(row.unitId),
  }).pipe(
    Effect.map(({ cohort, period, unit }) => ({
      locked: row.status === "archived" || cohortLocked(cohort, period, unit),
      units: [row.unitId],
    }))
  );

/** Whether a Person is a student placed in the cohort of the class, in the class's period. */
export const classMemberOf = (row: ClassesDoc, member: Member["Service"]) =>
  placementOf(row.periodId, member.person._id).pipe(
    Effect.map((placement) =>
      Option.exists(placement, (found) => found.cohortId === row.cohortId)
    )
  );

/**
 * Whether a Person teaches the class. The assignment counts only while the Person
 * still holds a teacher grant over the class's unit: revoking the grant ends the
 * teaching at once.
 */
export const subjectTeacherOf = (row: ClassesDoc, member: Member["Service"]) =>
  teachesUnit(member.grants, row.unitId)
    ? teacherAssignment(row._id, member.person._id).pipe(
        Effect.map(Option.isSome)
      )
    : Effect.succeed(false);

/**
 * A class is locked once it, its cohort, its period, or its unit is archived,
 * and its unit's grants cover it. `classMember` holds for a student placed in its
 * cohort in its period, and `subjectTeacher` for a Person assigned to teach it
 * who still holds a teacher grant over its unit.
 */
export const classAuthority = Authority.make(
  classKind,
  Authority.load(classKind),
  {
    place: placeClass,
    relations: {
      classMember: classMemberOf,
      subjectTeacher: subjectTeacherOf,
    },
    tenantOf: (row) => row.tenantId,
  }
);

/** Checks a class action on the class its access spec names, and provides the loaded class to the function. */
export const classAccess = MiddlewareImpl.make(
  databaseSchema,
  ClassAccess,
  classAuthority.middleware(Class)
);
