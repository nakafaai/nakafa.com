import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import {
  getSchoolMembership,
  loadActiveClass,
  requirePermission,
} from "@repo/backend/confect/modules/school/classAccess.service";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import { SCHOOL_CLASS_INVITE_CODE_ROLES } from "@repo/backend/confect/modules/school/classes/inviteCodes.service";
import type {
  SchoolClassImage,
  SchoolClassVisibility,
} from "@repo/backend/confect/modules/school/classes.tables";
import { getRandomClassImage } from "@repo/backend/confect/modules/school/images";
import { PERMISSIONS } from "@repo/backend/confect/modules/school/permissions";
import { Clock, Effect } from "effect";
import { nanoid } from "nanoid";

/** Fails when an invite code cannot currently be used. */
function validateInviteCodeState(
  inviteCode: Doc<"schoolClassInviteCodes">,
  now: number
) {
  if (!inviteCode.enabled) {
    return Effect.fail(
      new ClassActionError({ message: "This invite code has been disabled." })
    );
  }

  if (inviteCode.expiresAt !== undefined && inviteCode.expiresAt < now) {
    return Effect.fail(
      new ClassActionError({ message: "This invite code has expired." })
    );
  }

  if (
    inviteCode.maxUsage !== undefined &&
    inviteCode.currentUsage >= inviteCode.maxUsage
  ) {
    return Effect.fail(
      new ClassActionError({
        message: "This invite code has reached its usage limit.",
      })
    );
  }

  return Effect.succeed(inviteCode);
}

/** Fails when a class membership already exists. */
function validateNotExistingClassMembership(
  membership: Doc<"schoolClassMembers"> | null
) {
  if (!membership) {
    return Effect.succeed(null);
  }

  return Effect.fail(
    new ClassActionError({
      message: "You are already a member of this class.",
    })
  );
}

/** Creates a class and class invite codes for a school. */
export const createClass = Effect.fn("school.classes.createClass")(
  function* (args: {
    name: string;
    schoolId: Id<"schools">;
    subject: string;
    visibility: SchoolClassVisibility;
    year: string;
  }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const userId = user.appUser._id;
    yield* requirePermission(ctx, PERMISSIONS.CLASS_CREATE, {
      schoolId: args.schoolId,
      userId,
    });

    const now = yield* Clock.currentTimeMillis;
    const classId = yield* Effect.promise(() =>
      ctx.db.insert("schoolClasses", {
        createdBy: userId,
        image: getRandomClassImage(now.toString()),
        isArchived: false,
        name: args.name,
        schoolId: args.schoolId,
        studentCount: 0,
        subject: args.subject,
        teacherCount: 0,
        updatedAt: now,
        updatedBy: userId,
        visibility: args.visibility,
        year: args.year,
      })
    );

    yield* Effect.promise(() =>
      ctx.db.insert("schoolClassMembers", {
        addedBy: userId,
        classId,
        role: "teacher",
        schoolId: args.schoolId,
        teacherRole: "primary",
        updatedAt: now,
        userId,
      })
    );

    for (const role of SCHOOL_CLASS_INVITE_CODE_ROLES) {
      yield* Effect.promise(() =>
        ctx.db.insert("schoolClassInviteCodes", {
          classId,
          code: nanoid(10),
          createdBy: userId,
          currentUsage: 0,
          enabled: true,
          role,
          schoolId: args.schoolId,
          updatedAt: now,
          updatedBy: userId,
        })
      );
    }

    return classId;
  }
);

/** Joins the current user to a class with an invite code. */
export const joinClass = Effect.fn("school.classes.joinClass")(
  function* (args: { code: string }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const userId = user.appUser._id;
    const inviteCode = yield* Effect.promise(() =>
      ctx.db
        .query("schoolClassInviteCodes")
        .withIndex("by_code", (query) => query.eq("code", args.code))
        .unique()
    );

    if (!inviteCode) {
      return yield* Effect.fail(
        new ClassActionError({ message: "Invalid invite code." })
      );
    }

    const now = yield* Clock.currentTimeMillis;
    yield* validateInviteCodeState(inviteCode, now);

    const classData = yield* loadActiveClass(ctx, inviteCode.classId);
    const existingMember = yield* Effect.promise(() =>
      ctx.db
        .query("schoolClassMembers")
        .withIndex("by_classId_and_userId", (query) =>
          query.eq("classId", classData._id).eq("userId", userId)
        )
        .unique()
    );
    yield* validateNotExistingClassMembership(existingMember);

    const schoolMember = yield* getSchoolMembership(
      ctx,
      classData.schoolId,
      userId
    );

    if (!schoolMember) {
      return yield* Effect.fail(
        new ClassActionError({
          message: "You must be a member of the school to join this class.",
        })
      );
    }

    if (inviteCode.role === "teacher") {
      yield* Effect.promise(() =>
        ctx.db.insert("schoolClassMembers", {
          classId: classData._id,
          inviteCodeId: inviteCode._id,
          role: "teacher",
          schoolId: classData.schoolId,
          teacherRole: "co-teacher",
          updatedAt: now,
          userId,
        })
      );

      return { classId: classData._id };
    }

    yield* Effect.promise(() =>
      ctx.db.insert("schoolClassMembers", {
        classId: classData._id,
        enrollMethod: "by_code",
        inviteCodeId: inviteCode._id,
        role: "student",
        schoolId: classData.schoolId,
        updatedAt: now,
        userId,
      })
    );

    return { classId: classData._id };
  }
);

/** Joins the current user to a public class. */
export const joinPublicClass = Effect.fn("school.classes.joinPublicClass")(
  function* (args: { classId: Id<"schoolClasses"> }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const userId = user.appUser._id;
    const classData = yield* loadActiveClass(ctx, args.classId);

    if (classData.visibility !== "public") {
      return yield* Effect.fail(
        new ClassActionError({
          message:
            "This class is not public. Please use an invite code to join.",
        })
      );
    }

    const now = yield* Clock.currentTimeMillis;
    const existingMember = yield* Effect.promise(() =>
      ctx.db
        .query("schoolClassMembers")
        .withIndex("by_classId_and_userId", (query) =>
          query.eq("classId", classData._id).eq("userId", userId)
        )
        .unique()
    );
    yield* validateNotExistingClassMembership(existingMember);

    const schoolMember = yield* getSchoolMembership(
      ctx,
      classData.schoolId,
      userId
    );

    if (!schoolMember) {
      return yield* Effect.fail(
        new ClassActionError({
          message: "You must be a member of the school to join this class.",
        })
      );
    }

    yield* Effect.promise(() =>
      ctx.db.insert("schoolClassMembers", {
        classId: classData._id,
        enrollMethod: "public",
        role: "student",
        schoolId: classData.schoolId,
        updatedAt: now,
        userId,
      })
    );

    return { classId: classData._id };
  }
);

/** Updates a class image. */
export const updateClassImage = Effect.fn("school.classes.updateClassImage")(
  function* (args: { classId: Id<"schoolClasses">; image: SchoolClassImage }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const userId = user.appUser._id;
    const classData = yield* loadActiveClass(ctx, args.classId);
    yield* requirePermission(ctx, PERMISSIONS.CLASS_WRITE, {
      classId: args.classId,
      schoolId: classData.schoolId,
      userId,
    });
    const now = yield* Clock.currentTimeMillis;

    yield* Effect.promise(() =>
      ctx.db.patch(args.classId, {
        image: args.image,
        updatedAt: now,
        updatedBy: userId,
      })
    );

    return null;
  }
);

/** Updates class visibility. */
export const updateClassVisibility = Effect.fn(
  "school.classes.updateClassVisibility"
)(function* (args: {
  classId: Id<"schoolClasses">;
  visibility: SchoolClassVisibility;
}) {
  const ctx = yield* MutationCtx;
  const user = yield* requireAppUser(ctx);
  const userId = user.appUser._id;
  const classData = yield* loadActiveClass(ctx, args.classId);
  yield* requirePermission(ctx, PERMISSIONS.CLASS_WRITE, {
    classId: args.classId,
    schoolId: classData.schoolId,
    userId,
  });
  const now = yield* Clock.currentTimeMillis;

  yield* Effect.promise(() =>
    ctx.db.patch(args.classId, {
      updatedAt: now,
      updatedBy: userId,
      visibility: args.visibility,
    })
  );

  return null;
});
