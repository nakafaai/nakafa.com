import type { GenericId } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { CLASS_LIMIT } from "@repo/backend/confect/classroom/class";
import { Array as Arr, Effect, Schema } from "effect";

/**
 * A subject teacher of one class: a Person who teaches it. `periodId` is the
 * class's period, copied for indexing, so one Person's teaching of a period is
 * one indexed range.
 */
export const classTeacherValidator = Schema.Struct({
  classId: Id("classes"),
  createdAt: Schema.Finite,
  periodId: Id("tenantPeriods"),
  personId: Id("tenantPeople"),
  tenantId: Id("tenants"),
});

/** The assignment of one Person to teach one class, if it exists. */
export const teacherAssignment = Effect.fn("classroom.teacher.assignment")(
  function* (
    classId: GenericId.GenericId<"classes">,
    personId: GenericId.GenericId<"tenantPeople">
  ) {
    return yield* (yield* DatabaseReader)
      .table("classTeachers")
      .get("by_classId_and_personId", classId, personId)
      .pipe(
        Effect.asSome,
        Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
        Effect.orDie
      );
  }
);

/**
 * The classes one Person teaches in one period, archived ones included, at most
 * CLASS_LIMIT of them. The assignment refuses a class past that number, so the
 * read is never cut short.
 */
export const teachingIn = Effect.fn("classroom.teacher.teaching")(function* (
  personId: GenericId.GenericId<"tenantPeople">,
  periodId: GenericId.GenericId<"tenantPeriods">
) {
  return yield* (yield* DatabaseReader)
    .table("classTeachers")
    .index("by_personId_and_periodId", (query) =>
      query.eq("personId", personId).eq("periodId", periodId)
    )
    .take(CLASS_LIMIT)
    .pipe(Effect.orDie);
});

/**
 * Whether one Person holds an active teacher grant over a unit, or over the
 * whole school. Only a teacher of the unit may teach one of its classes.
 */
export const teacherOf = Effect.fn("classroom.teacher.grant")(function* (
  personId: GenericId.GenericId<"tenantPeople">,
  unitId: GenericId.GenericId<"tenantUnits">
) {
  const grants = yield* activeGrants(personId);
  return Arr.some(
    grants,
    (grant) =>
      grant.role.key === "teacher" &&
      GrantScope.match(grant.scope, {
        tenant: () => true,
        unit: (scope) => scope.unitId === unitId,
      })
  );
});
