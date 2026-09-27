import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  loadActiveClass,
  requireClassAccess,
} from "@repo/backend/confect/classes/access";
import {
  MIN_FORUM_THREAD_TEXT_LENGTH,
  STUDENT_FORUM_TAGS,
} from "@repo/backend/confect/classes/forums/constants";
import spec from "@repo/backend/confect/classes/forums/mutations/forums.spec";
import { ForumError } from "@repo/backend/confect/classes/forums/spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { isAdmin } from "@repo/backend/confect/schools/membership";
import { Clock, Effect, Layer } from "effect";

/**
 * Create a new forum inside a class.
 */
const createForum = FunctionImpl.make(
  databaseSchema,
  spec,
  "createForum",
  Effect.fn("classes.forums.mutations.forums.createForum")(function* (args) {
    const writer = yield* DatabaseWriter;
    const user = yield* requireAuth();
    const userId = user.appUser._id;
    const classData = yield* loadActiveClass(args.classId);
    const title = args.title.trim();
    const body = args.body.trim();
    if (title.length < MIN_FORUM_THREAD_TEXT_LENGTH) {
      return yield* new ForumError({
        code: "FORUM_TITLE_TOO_SHORT",
        message: "Forum title must be at least three characters long.",
      });
    }
    if (body.length < MIN_FORUM_THREAD_TEXT_LENGTH) {
      return yield* new ForumError({
        code: "FORUM_BODY_TOO_SHORT",
        message: "Forum description must be at least three characters long.",
      });
    }
    const { classMembership, schoolMembership } = yield* requireClassAccess(
      args.classId,
      classData.schoolId,
      userId
    );
    const canCreateManagedForumTag =
      isAdmin(schoolMembership) || classMembership?.role === "teacher";
    if (
      !(
        canCreateManagedForumTag ||
        STUDENT_FORUM_TAGS.some((tag) => tag === args.tag)
      )
    ) {
      return yield* new ForumError({
        code: "FORUM_TAG_ACCESS_DENIED",
        message: "You do not have access to create this forum tag.",
      });
    }
    const now = yield* Clock.currentTimeMillis;
    return yield* writer
      .table("schoolClassForums")
      .insert({
        body,
        classId: args.classId,
        createdBy: userId,
        isPinned: false,
        lastPostAt: now,
        lastPostBy: userId,
        nextPostSequence: 1,
        postCount: 0,
        reactionCounts: [],
        schoolId: classData.schoolId,
        status: "open",
        tag: args.tag,
        title,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(createForum),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
