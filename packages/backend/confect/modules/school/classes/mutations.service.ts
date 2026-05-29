import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import {
  getSchoolMembership,
  loadActiveClass,
  requirePermission,
} from "@repo/backend/confect/modules/school/classAccess.service";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import { SCHOOL_CLASS_INVITE_CODE_ROLES } from "@repo/backend/confect/modules/school/classes/inviteCodes.service";
import type {
  SchoolClassImage,
  SchoolClassMembers,
  SchoolClassVisibility,
} from "@repo/backend/confect/modules/school/classes.tables";
import { getRandomClassImage } from "@repo/backend/confect/modules/school/images";
import { PERMISSIONS } from "@repo/backend/confect/modules/school/permissions";
import { Clock, Effect } from "effect";
import { nanoid } from "nanoid";

type ClassMemberFields = typeof SchoolClassMembers.Fields.Type;

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

/** Applies the denormalized class member count for one membership write. */
const updateClassMemberCount = Effect.fnUntraced(function* (
  classId: Id<"schoolClasses">,
  role: ClassMemberFields["role"],
  delta: number
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const classData = yield* reader
    .table("schoolClasses")
    .get(classId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!classData) {
    return null;
  }

  if (role === "teacher") {
    yield* writer.table("schoolClasses").patch(classId, {
      teacherCount: Math.max(classData.teacherCount + delta, 0),
    });
    return null;
  }

  yield* writer.table("schoolClasses").patch(classId, {
    studentCount: Math.max(classData.studentCount + delta, 0),
  });

  return null;
});

/** Inserts a class member and applies the side effects previously hidden in triggers. */
const insertClassMember = Effect.fnUntraced(function* (
  member: ClassMemberFields
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const memberId = yield* writer.table("schoolClassMembers").insert(member);
  const now = yield* Clock.currentTimeMillis;

  const inviteCodeId = member.inviteCodeId;

  if (inviteCodeId) {
    const inviteCode = yield* reader
      .table("schoolClassInviteCodes")
      .get(inviteCodeId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (inviteCode) {
      yield* writer.table("schoolClassInviteCodes").patch(inviteCodeId, {
        currentUsage: inviteCode.currentUsage + 1,
        updatedAt: now,
      });
    }
  }

  yield* updateClassMemberCount(member.classId, member.role, 1);
  yield* writer.table("schoolActivityLogs").insert({
    action: "class_member_added",
    entityId: memberId,
    entityType: "schoolClassMembers",
    metadata: {
      addedUserId: member.userId,
      classId: member.classId,
      enrollMethod: member.enrollMethod,
      role: member.role,
      teacherRole: member.teacherRole,
    },
    schoolId: member.schoolId,
    userId: member.addedBy ?? member.userId,
  });

  return memberId;
});

/** Creates a class and class invite codes for a school. */
export const createClass = Effect.fnUntraced(function* (args: {
  name: string;
  schoolId: Id<"schools">;
  subject: string;
  visibility: SchoolClassVisibility;
  year: string;
}) {
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const userId = user.appUser._id;
  yield* requirePermission(PERMISSIONS.CLASS_CREATE, {
    schoolId: args.schoolId,
    userId,
  });

  const now = yield* Clock.currentTimeMillis;
  const classId = yield* writer.table("schoolClasses").insert({
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
  });

  yield* insertClassMember({
    addedBy: userId,
    classId,
    role: "teacher",
    schoolId: args.schoolId,
    teacherRole: "primary",
    updatedAt: now,
    userId,
  });

  for (const role of SCHOOL_CLASS_INVITE_CODE_ROLES) {
    yield* writer.table("schoolClassInviteCodes").insert({
      classId,
      code: nanoid(10),
      createdBy: userId,
      currentUsage: 0,
      enabled: true,
      role,
      schoolId: args.schoolId,
      updatedAt: now,
      updatedBy: userId,
    });
  }

  return classId;
});

/** Joins the current user to a class with an invite code. */
export const joinClass = Effect.fnUntraced(function* (args: { code: string }) {
  const reader = yield* DatabaseReader;
  const user = yield* requireAppUser();
  const userId = user.appUser._id;
  const inviteCode = yield* reader
    .table("schoolClassInviteCodes")
    .get("by_code", args.code)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

  if (!inviteCode) {
    return yield* Effect.fail(
      new ClassActionError({ message: "Invalid invite code." })
    );
  }

  const now = yield* Clock.currentTimeMillis;
  yield* validateInviteCodeState(inviteCode, now);

  const classData = yield* loadActiveClass(inviteCode.classId);
  const existingMember = yield* reader
    .table("schoolClassMembers")
    .get("by_classId_and_userId", classData._id, userId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
  yield* validateNotExistingClassMembership(existingMember);

  const schoolMember = yield* getSchoolMembership(classData.schoolId, userId);

  if (!schoolMember) {
    return yield* Effect.fail(
      new ClassActionError({
        message: "You must be a member of the school to join this class.",
      })
    );
  }

  if (inviteCode.role === "teacher") {
    yield* insertClassMember({
      classId: classData._id,
      inviteCodeId: inviteCode._id,
      role: "teacher",
      schoolId: classData.schoolId,
      teacherRole: "co-teacher",
      updatedAt: now,
      userId,
    });

    return { classId: classData._id };
  }

  yield* insertClassMember({
    classId: classData._id,
    enrollMethod: "by_code",
    inviteCodeId: inviteCode._id,
    role: "student",
    schoolId: classData.schoolId,
    updatedAt: now,
    userId,
  });

  return { classId: classData._id };
});

/** Joins the current user to a public class. */
export const joinPublicClass = Effect.fnUntraced(function* (args: {
  classId: Id<"schoolClasses">;
}) {
  const reader = yield* DatabaseReader;
  const user = yield* requireAppUser();
  const userId = user.appUser._id;
  const classData = yield* loadActiveClass(args.classId);

  if (classData.visibility !== "public") {
    return yield* Effect.fail(
      new ClassActionError({
        message: "This class is not public. Please use an invite code to join.",
      })
    );
  }

  const now = yield* Clock.currentTimeMillis;
  const existingMember = yield* reader
    .table("schoolClassMembers")
    .get("by_classId_and_userId", classData._id, userId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
  yield* validateNotExistingClassMembership(existingMember);

  const schoolMember = yield* getSchoolMembership(classData.schoolId, userId);

  if (!schoolMember) {
    return yield* Effect.fail(
      new ClassActionError({
        message: "You must be a member of the school to join this class.",
      })
    );
  }

  yield* insertClassMember({
    classId: classData._id,
    enrollMethod: "public",
    role: "student",
    schoolId: classData.schoolId,
    updatedAt: now,
    userId,
  });

  return { classId: classData._id };
});

/** Updates a class image. */
export const updateClassImage = Effect.fnUntraced(function* (args: {
  classId: Id<"schoolClasses">;
  image: SchoolClassImage;
}) {
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const userId = user.appUser._id;
  const classData = yield* loadActiveClass(args.classId);
  yield* requirePermission(PERMISSIONS.CLASS_WRITE, {
    classId: args.classId,
    schoolId: classData.schoolId,
    userId,
  });
  const now = yield* Clock.currentTimeMillis;

  yield* writer.table("schoolClasses").patch(args.classId, {
    image: args.image,
    updatedAt: now,
    updatedBy: userId,
  });

  return null;
});

/** Updates class visibility. */
export const updateClassVisibility = Effect.fnUntraced(function* (args: {
  classId: Id<"schoolClasses">;
  visibility: SchoolClassVisibility;
}) {
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const userId = user.appUser._id;
  const classData = yield* loadActiveClass(args.classId);
  yield* requirePermission(PERMISSIONS.CLASS_WRITE, {
    classId: args.classId,
    schoolId: classData.schoolId,
    userId,
  });
  const now = yield* Clock.currentTimeMillis;

  yield* writer.table("schoolClasses").patch(args.classId, {
    updatedAt: now,
    updatedBy: userId,
    visibility: args.visibility,
  });

  return null;
});
