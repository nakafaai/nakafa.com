import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { loadActiveClass } from "@repo/backend/confect/classes/access";
import { SCHOOL_CLASS_INVITE_CODE_ROLES } from "@repo/backend/confect/classes/constants";
import spec, {
  ClassMutationError,
} from "@repo/backend/confect/classes/mutations.spec";
import {
  getRandomClassImage,
  isValidClassImage,
} from "@repo/backend/confect/lib/images";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import {
  validateInviteCodeState,
  validateNotExistingMembership,
} from "@repo/backend/confect/schools/invitations";
import { getSchoolMembership } from "@repo/backend/confect/schools/membership";
import { requirePermission } from "@repo/backend/confect/schools/permission/access";
import { PERMISSIONS } from "@repo/backend/confect/schools/permission/spec";
import { generateNanoId } from "@repo/backend/confect/utils/id";
import { Clock, Effect, Layer } from "effect";

/** Create one class and its default teacher/student invite codes. */
const createClass = FunctionImpl.make(
  databaseSchema,
  spec,
  "createClass",
  Effect.fn("classes.mutations.createClass")(function* (args) {
    const writer = yield* DatabaseWriter;
    const user = yield* requireAuth();
    const userId = user.appUser._id;
    yield* requirePermission(PERMISSIONS.CLASS_CREATE, {
      schoolId: args.schoolId,
      userId,
    });
    const now = yield* Clock.currentTimeMillis;
    const classId = yield* writer
      .table("schoolClasses")
      .insert({
        schoolId: args.schoolId,
        name: args.name,
        subject: args.subject,
        year: args.year,
        image: getRandomClassImage(now.toString()),
        isArchived: false,
        visibility: args.visibility,
        studentCount: 0,
        teacherCount: 0,
        createdBy: userId,
        updatedBy: userId,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("schoolClassMembers")
      .insert({
        classId,
        userId,
        schoolId: args.schoolId,
        role: "teacher",
        teacherRole: "primary",
        updatedAt: now,
        addedBy: userId,
      })
      .pipe(Effect.orDie);
    for (const role of SCHOOL_CLASS_INVITE_CODE_ROLES) {
      yield* writer
        .table("schoolClassInviteCodes")
        .insert({
          classId,
          schoolId: args.schoolId,
          role,
          code: generateNanoId(),
          enabled: true,
          currentUsage: 0,
          createdBy: userId,
          updatedBy: userId,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
    }
    return classId;
  })
);
const joinClass = FunctionImpl.make(
  databaseSchema,
  spec,
  "joinClass",
  Effect.fn("classes.mutations.joinClass")(function* (args) {
    const writer = yield* DatabaseWriter;
    const database = yield* DatabaseReader;
    const user = yield* requireAuth();
    const userId = user.appUser._id;
    const inviteCode = yield* database
      .table("schoolClassInviteCodes")
      .get("by_code", args.code)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!inviteCode) {
      return yield* new ClassMutationError({
        code: "INVALID_CODE",
        message: "Invalid invite code.",
      });
    }
    yield* validateInviteCodeState(inviteCode);
    const classData = yield* loadActiveClass(inviteCode.classId);
    const now = yield* Clock.currentTimeMillis;
    const existingMember = yield* database
      .table("schoolClassMembers")
      .get("by_classId_and_userId", classData._id, userId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    yield* validateNotExistingMembership(existingMember, "class");
    const schoolMember = yield* getSchoolMembership(classData.schoolId, userId);
    if (!schoolMember) {
      return yield* new ClassMutationError({
        code: "NOT_SCHOOL_MEMBER",
        message: "You must be a member of the school to join this class.",
      });
    }
    if (inviteCode.role === "teacher") {
      yield* writer
        .table("schoolClassMembers")
        .insert({
          classId: classData._id,
          userId,
          schoolId: classData.schoolId,
          role: "teacher",
          teacherRole: "co-teacher",
          inviteCodeId: inviteCode._id,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
    } else {
      yield* writer
        .table("schoolClassMembers")
        .insert({
          classId: classData._id,
          userId,
          schoolId: classData.schoolId,
          role: "student",
          enrollMethod: "by_code",
          inviteCodeId: inviteCode._id,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
    }
    return {
      classId: classData._id,
    };
  })
);
const updateClassVisibility = FunctionImpl.make(
  databaseSchema,
  spec,
  "updateClassVisibility",
  Effect.fn("classes.mutations.updateClassVisibility")(function* (args) {
    const writer = yield* DatabaseWriter;
    const { appUser } = yield* requireAuth();
    const userId = appUser._id;
    const classData = yield* loadActiveClass(args.classId);
    yield* requirePermission(PERMISSIONS.CLASS_WRITE, {
      userId,
      classId: args.classId,
      schoolId: classData.schoolId,
    });
    yield* writer
      .table("schoolClasses")
      .patch(args.classId, {
        visibility: args.visibility,
        updatedBy: userId,
        updatedAt: yield* Clock.currentTimeMillis,
      })
      .pipe(Effect.orDie);
    return null;
  })
);
const joinPublicClass = FunctionImpl.make(
  databaseSchema,
  spec,
  "joinPublicClass",
  Effect.fn("classes.mutations.joinPublicClass")(function* (args) {
    const writer = yield* DatabaseWriter;
    const database = yield* DatabaseReader;
    const user = yield* requireAuth();
    const userId = user.appUser._id;
    const classData = yield* loadActiveClass(args.classId);
    if (classData.visibility !== "public") {
      return yield* new ClassMutationError({
        code: "CLASS_NOT_PUBLIC",
        message: "This class is not public. Please use an invite code to join.",
      });
    }
    const now = yield* Clock.currentTimeMillis;
    const existingMember = yield* database
      .table("schoolClassMembers")
      .get("by_classId_and_userId", classData._id, userId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    yield* validateNotExistingMembership(existingMember, "class");
    const schoolMember = yield* getSchoolMembership(classData.schoolId, userId);
    if (!schoolMember) {
      return yield* new ClassMutationError({
        code: "NOT_SCHOOL_MEMBER",
        message: "You must be a member of the school to join this class.",
      });
    }
    yield* writer
      .table("schoolClassMembers")
      .insert({
        classId: classData._id,
        userId,
        schoolId: classData.schoolId,
        role: "student",
        enrollMethod: "public",
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    return {
      classId: classData._id,
    };
  })
);
const updateClassImage = FunctionImpl.make(
  databaseSchema,
  spec,
  "updateClassImage",
  Effect.fn("classes.mutations.updateClassImage")(function* (args) {
    const writer = yield* DatabaseWriter;
    const { appUser } = yield* requireAuth();
    const userId = appUser._id;
    const classData = yield* loadActiveClass(args.classId);
    yield* requirePermission(PERMISSIONS.CLASS_WRITE, {
      userId,
      classId: args.classId,
      schoolId: classData.schoolId,
    });
    if (!isValidClassImage(args.image)) {
      return yield* new ClassMutationError({
        code: "INVALID_IMAGE",
        message: "Invalid class image. Please select a valid image.",
      });
    }
    yield* writer
      .table("schoolClasses")
      .patch(args.classId, {
        image: args.image,
        updatedBy: userId,
        updatedAt: yield* Clock.currentTimeMillis,
      })
      .pipe(Effect.orDie);
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(createClass),
  Layer.provide(joinClass),
  Layer.provide(updateClassVisibility),
  Layer.provide(joinPublicClass),
  Layer.provide(updateClassImage),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
