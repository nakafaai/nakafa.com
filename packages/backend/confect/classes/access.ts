import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ClassAccessError } from "@repo/backend/confect/classes/access/spec";
import {
  getSchoolMembership,
  isAdmin,
} from "@repo/backend/confect/schools/membership";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/** Load the decoded class or report a typed missing-class failure. */
export const loadClass = Effect.fn("classes.access.load")(function* (
  classId: Id<"schoolClasses">
) {
  return yield* (yield* DatabaseReader)
    .table("schoolClasses")
    .get(classId)
    .pipe(
      Effect.catchTag("DocumentDecodeError", Effect.die),
      Effect.mapError(
        () =>
          new ClassAccessError({
            code: "CLASS_NOT_FOUND",
            message: "Class not found.",
          })
      )
    );
});

/** Archived classes cannot accept changes. */
export const loadActiveClass = Effect.fn("classes.access.active")(function* (
  classId: Id<"schoolClasses">
) {
  const value = yield* loadClass(classId);
  if (value.isArchived) {
    return yield* new ClassAccessError({
      code: "CLASS_ARCHIVED",
      message: "Cannot modify an archived class.",
    });
  }
  return value;
});

/** Read both grants so callers can present membership and admin capabilities. */
export const checkClassAccess = Effect.fn("classes.access.check")(function* (
  classId: Id<"schoolClasses">,
  schoolId: Id<"schools">,
  userId: Id<"users">
) {
  const schoolMembership = yield* getSchoolMembership(schoolId, userId);
  const classMembership = yield* (yield* DatabaseReader)
    .table("schoolClassMembers")
    .get("by_classId_and_userId", classId, userId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  return {
    hasAccess: classMembership !== null || isAdmin(schoolMembership),
    classMembership,
    schoolMembership,
  };
});

/** Require both active school membership and an explicit class or admin grant. */
export const requireClassAccess = Effect.fn("classes.access.require")(
  function* (
    classId: Id<"schoolClasses">,
    schoolId: Id<"schools">,
    userId: Id<"users">
  ) {
    const access = yield* checkClassAccess(classId, schoolId, userId);
    if (!access.schoolMembership) {
      return yield* new ClassAccessError({
        code: "ACCESS_DENIED",
        message: "You must be a member of this school to access this class.",
      });
    }
    if (!access.hasAccess) {
      return yield* new ClassAccessError({
        code: "ACCESS_DENIED",
        message: "You do not have access to this class.",
      });
    }
    return {
      classMembership: access.classMembership,
      schoolMembership: access.schoolMembership,
    };
  }
);
