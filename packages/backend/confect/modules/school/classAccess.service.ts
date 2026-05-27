import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import type {
  MutationCtx as ConvexMutationCtx,
  QueryCtx as ConvexQueryCtx,
} from "@repo/backend/confect/_generated/services";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import type { Permission } from "@repo/backend/confect/modules/school/permissions";
import { roleHasPermission } from "@repo/backend/confect/modules/school/permissions";
import { Effect } from "effect";

type DatabaseCtx = ConvexMutationCtx | ConvexQueryCtx;
type SchoolMembership = Doc<"schoolMembers"> | null;
type PublicUser = Pick<Doc<"users">, "_id" | "email" | "image" | "name">;

/** Returns whether a school membership has administrative privileges. */
export function isAdmin(membership: SchoolMembership) {
  return membership?.role === "admin";
}

/** Reads an active school membership for a user. */
export const getSchoolMembership = Effect.fn(
  "school.classAccess.getSchoolMembership"
)(function* (ctx: DatabaseCtx, schoolId: Id<"schools">, userId: Id<"users">) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("schoolMembers")
      .withIndex("by_schoolId_and_userId_and_status", (query) =>
        query
          .eq("schoolId", schoolId)
          .eq("userId", userId)
          .eq("status", "active")
      )
      .unique()
  );
});

/** Reads class membership for a user. */
export const getClassMembership = Effect.fn(
  "school.classAccess.getClassMembership"
)(function* (
  ctx: DatabaseCtx,
  classId: Id<"schoolClasses">,
  userId: Id<"users">
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassMembers")
      .withIndex("by_classId_and_userId", (query) =>
        query.eq("classId", classId).eq("userId", userId)
      )
      .unique()
  );
});

/** Loads a class or fails with the domain class error. */
export const loadClass = Effect.fn("school.classAccess.loadClass")(function* (
  ctx: DatabaseCtx,
  classId: Id<"schoolClasses">
) {
  const classData = yield* Effect.promise(() => ctx.db.get(classId));

  if (!classData) {
    return yield* Effect.fail(
      new ClassActionError({ message: "Class not found." })
    );
  }

  return classData;
});

/** Loads a class that can still be modified. */
export const loadActiveClass = Effect.fn("school.classAccess.loadActiveClass")(
  function* (ctx: DatabaseCtx, classId: Id<"schoolClasses">) {
    const classData = yield* loadClass(ctx, classId);

    if (classData.isArchived) {
      return yield* Effect.fail(
        new ClassActionError({ message: "Cannot modify an archived class." })
      );
    }

    return classData;
  }
);

/** Checks both school and class access for a user. */
export const checkClassAccess = Effect.fn(
  "school.classAccess.checkClassAccess"
)(function* (
  ctx: DatabaseCtx,
  classId: Id<"schoolClasses">,
  schoolId: Id<"schools">,
  userId: Id<"users">
) {
  const schoolMembership = yield* getSchoolMembership(ctx, schoolId, userId);
  const classMembership = yield* getClassMembership(ctx, classId, userId);
  const hasAccess = classMembership !== null || isAdmin(schoolMembership);

  return { classMembership, hasAccess, schoolMembership };
});

/** Requires the current user to be a school member with class access. */
export const requireClassAccess = Effect.fn(
  "school.classAccess.requireClassAccess"
)(function* (
  ctx: DatabaseCtx,
  classId: Id<"schoolClasses">,
  schoolId: Id<"schools">,
  userId: Id<"users">
) {
  const access = yield* checkClassAccess(ctx, classId, schoolId, userId);

  if (!access.schoolMembership) {
    return yield* Effect.fail(
      new ClassActionError({
        message: "You must be a member of this school to access this class.",
      })
    );
  }

  if (!access.hasAccess) {
    return yield* Effect.fail(
      new ClassActionError({ message: "You do not have access to this class." })
    );
  }

  return {
    classMembership: access.classMembership,
    schoolMembership: access.schoolMembership,
  };
});

/** Checks whether school or class roles grant a permission. */
export const checkPermission = Effect.fn("school.classAccess.checkPermission")(
  function* (
    ctx: DatabaseCtx,
    permission: Permission,
    scope: {
      readonly classId?: Id<"schoolClasses">;
      readonly schoolId?: Id<"schools">;
      readonly userId: Id<"users">;
    }
  ) {
    const schoolId = scope.schoolId;
    if (schoolId) {
      const schoolMember = yield* getSchoolMembership(
        ctx,
        schoolId,
        scope.userId
      );

      if (roleHasPermission(schoolMember?.role, permission)) {
        return true;
      }
    }

    const classId = scope.classId;
    if (classId) {
      const classMember = yield* getClassMembership(ctx, classId, scope.userId);

      if (roleHasPermission(classMember?.role, permission)) {
        return true;
      }

      if (roleHasPermission(classMember?.teacherRole, permission)) {
        return true;
      }
    }

    return false;
  }
);

/** Fails when a user does not have the required permission. */
export const requirePermission = Effect.fn(
  "school.classAccess.requirePermission"
)(function* (
  ctx: DatabaseCtx,
  permission: Permission,
  scope: {
    readonly classId?: Id<"schoolClasses">;
    readonly schoolId?: Id<"schools">;
    readonly userId: Id<"users">;
  }
) {
  const hasPermission = yield* checkPermission(ctx, permission, scope);

  if (!hasPermission) {
    return yield* Effect.fail(
      new ClassActionError({ message: `Permission '${permission}' required` })
    );
  }
});

/** Reads public user details for joined class member rows. */
export const getUserMap = Effect.fn("school.classAccess.getUserMap")(function* (
  ctx: DatabaseCtx,
  userIds: readonly Id<"users">[]
) {
  const uniqueUserIds = [...new Set(userIds)];
  const entries: [Id<"users">, PublicUser][] = [];

  for (const userId of uniqueUserIds) {
    const user = yield* Effect.promise(() => ctx.db.get(userId));

    if (!user) {
      continue;
    }

    entries.push([
      userId,
      {
        _id: user._id,
        email: user.email,
        image: user.image,
        name: user.name,
      },
    ]);
  }

  return new Map(entries);
});
