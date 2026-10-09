import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  type Permission,
  PermissionDenied,
  ROLE_PERMISSIONS,
} from "@repo/backend/confect/schools/permission/spec";
import { Effect, Schema } from "effect";

const PermissionTargetSchema = Schema.Struct({
  classId: Schema.optionalKey(IdSchema("schoolClasses")),
  schoolId: Schema.optionalKey(IdSchema("schools")),
  userId: IdSchema("users"),
});
type PermissionTarget = typeof PermissionTargetSchema.Type;
/** Checks school grants before class grants and teacher-specific additions. */
const checkPermission = Effect.fn("permissions.check")(function* (
  permission: Permission,
  { userId, schoolId, classId }: PermissionTarget
) {
  const database = yield* DatabaseReader;
  if (schoolId) {
    const schoolMember = yield* database
      .table("schoolMembers")
      .get("by_schoolId_and_userId_and_status", schoolId, userId, "active")
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (
      schoolMember &&
      ROLE_PERMISSIONS[schoolMember.role].includes(permission)
    ) {
      return true;
    }
  }
  if (!classId) {
    return false;
  }
  const classMember = yield* database
    .table("schoolClassMembers")
    .get("by_classId_and_userId", classId, userId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!classMember) {
    return false;
  }
  if (ROLE_PERMISSIONS[classMember.role].includes(permission)) {
    return true;
  }
  if (classMember.role !== "teacher" || !classMember.teacherRole) {
    return false;
  }
  return ROLE_PERMISSIONS[classMember.teacherRole].includes(permission);
});

/** Requires an explicit school or class grant using the existing FORBIDDEN contract. */
export const requirePermission = Effect.fn("permissions.require")(function* (
  permission: Permission,
  target: PermissionTarget
) {
  if (!(yield* checkPermission(permission, target))) {
    return yield* PermissionDenied.make({
      code: "FORBIDDEN",
      message: `Permission '${permission}' required`,
    });
  }
});
