import type { GenericId } from "@confect/core";
import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Authority } from "@repo/backend/confect/access/policy";
import { Class, ClassAccess } from "@repo/backend/confect/classroom/access";
import { classKind } from "@repo/backend/confect/classroom/kinds";
import { teacherAssignment } from "@repo/backend/confect/classroom/teacher";
import { placementOf } from "@repo/backend/confect/tenancy/authority";
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
 * A class is locked once it, its cohort, its period, or its unit is archived,
 * and its unit's grants cover it. `classMember` holds for a student placed in its
 * cohort in its period, and `subjectTeacher` for a Person assigned to teach it.
 */
export const classAuthority = Authority.make(
  classKind,
  Authority.load(classKind),
  {
    place: (row) =>
      Effect.all({
        cohort: readCohort(row.cohortId),
        period: readPeriod(row.periodId),
        unit: readUnit(row.unitId),
      }).pipe(
        Effect.map(({ cohort, period, unit }) => ({
          locked:
            row.status === "archived" ||
            cohort.status === "archived" ||
            period.status === "archived" ||
            unit.status === "archived",
          units: [row.unitId],
        }))
      ),
    relations: {
      classMember: (row, member) =>
        placementOf(row.periodId, member.person._id).pipe(
          Effect.map((placement) =>
            Option.exists(placement, (found) => found.cohortId === row.cohortId)
          )
        ),
      subjectTeacher: (row, member) =>
        teacherAssignment(row._id, member.person._id).pipe(
          Effect.map(Option.isSome)
        ),
    },
    tenantOf: (row) => row.tenantId,
  }
);

export const classAccess = MiddlewareImpl.make(
  databaseSchema,
  ClassAccess,
  classAuthority.middleware(Class)
);
