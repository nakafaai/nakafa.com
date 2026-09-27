import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { cleanupForumData } from "@repo/backend/confect/classes/forums/cleanup";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import spec from "@repo/backend/confect/triggers/schools/cleanup.spec";
import { Duration, Effect, Layer } from "effect";

const MEMBER_BATCH_SIZE = 100;
const INVITE_BATCH_SIZE = 100;
const FORUM_BATCH_SIZE = 25;
const MATERIAL_GROUP_BATCH_SIZE = 25;

/** Drain class dependencies in bounded transactions after the class is deleted. */
const cleanupDeletedClass = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupDeletedClass",
  Effect.fn("triggers.schools.cleanup.cleanupDeletedClass")(function* (args) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const scheduler = yield* Scheduler;
    const classMembers = yield* reader
      .table("schoolClassMembers")
      .index("by_classId_and_userId", (q) => q.eq("classId", args.classId))
      .take(MEMBER_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const member of classMembers) {
      yield* writer
        .table("schoolClassMembers")
        .delete(member._id)
        .pipe(Effect.orDie);
    }
    if (classMembers.length === MEMBER_BATCH_SIZE) {
      yield* scheduler.runAfter(
        Duration.zero,
        refs.internal.triggers.schools.cleanup.cleanupDeletedClass,
        args
      );
      return null;
    }
    const inviteCodes = yield* reader
      .table("schoolClassInviteCodes")
      .index("by_classId_and_role", (q) => q.eq("classId", args.classId))
      .take(INVITE_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const inviteCode of inviteCodes) {
      yield* writer
        .table("schoolClassInviteCodes")
        .delete(inviteCode._id)
        .pipe(Effect.orDie);
    }
    if (inviteCodes.length === INVITE_BATCH_SIZE) {
      yield* scheduler.runAfter(
        Duration.zero,
        refs.internal.triggers.schools.cleanup.cleanupDeletedClass,
        args
      );
      return null;
    }
    const forums = yield* reader
      .table("schoolClassForums")
      .index("by_classId_and_lastPostAt", (q) => q.eq("classId", args.classId))
      .take(FORUM_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const forum of forums) {
      yield* scheduler.runAfter(
        Duration.zero,
        refs.internal.triggers.schools.cleanup.cleanupDeletedForum,
        {
          forumId: forum._id,
        }
      );
      yield* writer
        .table("schoolClassForums")
        .delete(forum._id)
        .pipe(Effect.orDie);
    }
    if (forums.length === FORUM_BATCH_SIZE) {
      yield* scheduler.runAfter(
        Duration.zero,
        refs.internal.triggers.schools.cleanup.cleanupDeletedClass,
        args
      );
      return null;
    }
    const materialGroups = yield* reader
      .table("schoolClassMaterialGroups")
      .index("by_classId_and_parentId_and_order", (q) =>
        q.eq("classId", args.classId)
      )
      .take(MATERIAL_GROUP_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const group of materialGroups) {
      yield* writer
        .table("schoolClassMaterialGroups")
        .delete(group._id)
        .pipe(Effect.orDie);
    }
    if (materialGroups.length === MATERIAL_GROUP_BATCH_SIZE) {
      yield* scheduler.runAfter(
        Duration.zero,
        refs.internal.triggers.schools.cleanup.cleanupDeletedClass,
        args
      );
    }
    return null;
  })
);
const cleanupDeletedForum = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupDeletedForum",
  Effect.fn("triggers.schools.cleanup.cleanupDeletedForum")(function* (args) {
    const scheduler = yield* Scheduler;
    if (yield* cleanupForumData(args.forumId)) {
      yield* scheduler.runAfter(
        Duration.zero,
        refs.internal.triggers.schools.cleanup.cleanupDeletedForum,
        args
      );
    }
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(cleanupDeletedClass),
  Layer.provide(cleanupDeletedForum),
  Layer.provide(atomic),
  GroupImpl.finalize
);
