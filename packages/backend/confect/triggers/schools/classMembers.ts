import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type {
  DataModel,
  Doc,
  Id,
} from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Clock, Effect, Match, Struct } from "effect";

/**
 * Trigger handler for schoolClassMembers table changes.
 *
 * Manages class membership with denormalized counts and activity logging:
 * - Tracks invite code usage for class joins
 * - Updates teacher/student counts on member changes
 * - Logs member additions, role changes, and removals
 * - Handles teacher role specialization changes
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export const schoolClassMembersHandler = Effect.fn(
  "triggers.schools.recordClassMember"
)(function* (change: Change<DataModel, "schoolClassMembers">) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  yield* Match.value(change).pipe(
    Match.discriminatorsExhaustive("operation")({
      insert: (inserted) =>
        Effect.gen(function* () {
          const member = inserted.newDoc;
          if (member.inviteCodeId) {
            const inviteCodeId = member.inviteCodeId;
            const inviteCode = yield* database
              .table("schoolClassInviteCodes")
              .get(inviteCodeId)
              .pipe(
                Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
                Effect.orDie
              );
            if (inviteCode) {
              yield* writer
                .table("schoolClassInviteCodes")
                .patch(inviteCodeId, {
                  currentUsage: inviteCode.currentUsage + 1,
                  updatedAt: yield* Clock.currentTimeMillis,
                })
                .pipe(Effect.orDie);
            }
          }
          yield* updateClassMemberCount(member.classId, member.role, 1);
          yield* writer
            .table("schoolActivityLogs")
            .insert({
              schoolId: member.schoolId,
              userId: member.addedBy ?? member.userId,
              action: "class_member_added",
              entityType: "schoolClassMembers",
              entityId: inserted.id,
              metadata: {
                classId: member.classId,
                addedUserId: member.userId,
                role: member.role,
                ...Struct.pick(member, ["teacherRole", "enrollMethod"]),
              },
            })
            .pipe(Effect.orDie);
        }),
      update: (updated) =>
        Effect.gen(function* () {
          const member = updated.newDoc;
          const oldMember = updated.oldDoc;
          if (oldMember.role !== member.role) {
            yield* handleRoleChange(updated.id, member, oldMember);
          }
          if (
            oldMember.teacherRole !== member.teacherRole &&
            member.role === "teacher"
          ) {
            yield* writer
              .table("schoolActivityLogs")
              .insert({
                schoolId: member.schoolId,
                userId: member.userId,
                action: "class_member_teacher_role_changed",
                entityType: "schoolClassMembers",
                entityId: updated.id,
                metadata: {
                  classId: member.classId,
                  ...Struct.renameKeys(
                    Struct.pick(oldMember, ["teacherRole"]),
                    {
                      teacherRole: "oldTeacherRole",
                    }
                  ),
                  ...Struct.renameKeys(Struct.pick(member, ["teacherRole"]), {
                    teacherRole: "newTeacherRole",
                  }),
                },
              })
              .pipe(Effect.orDie);
          }
        }),
      delete: (deleted) =>
        Effect.gen(function* () {
          const oldMember = deleted.oldDoc;
          yield* updateClassMemberCount(oldMember.classId, oldMember.role, -1);
          yield* writer
            .table("schoolActivityLogs")
            .insert({
              schoolId: oldMember.schoolId,
              userId: oldMember.removedBy ?? oldMember.userId,
              action: "class_member_removed",
              entityType: "schoolClassMembers",
              entityId: deleted.id,
              metadata: {
                classId: oldMember.classId,
                removedUserId: oldMember.userId,
                role: oldMember.role,
                ...Struct.pick(oldMember, ["removedAt"]),
              },
            })
            .pipe(Effect.orDie);
        }),
    })
  );
});

/** Convex trigger boundary, preserving atomic writes within its mutation. */

/** Apply one membership insertion or deletion to its class counter. */
const updateClassMemberCount = Effect.fn(
  "triggers.schools.updateClassMemberCount"
)(function* (
  classId: Id<"schoolClasses">,
  role: Doc<"schoolClassMembers">["role"],
  delta: number
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const classDoc = yield* database
    .table("schoolClasses")
    .get(classId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
  if (!classDoc) {
    return;
  }
  const field = role === "teacher" ? "teacherCount" : "studentCount";
  yield* writer.table("schoolClasses").patch(classId, {
    [field]: Math.max(classDoc[field] + delta, 0),
  });
}, Effect.orDie);

/** Transfer a changed membership between class counters and record its audit row. */
const handleRoleChange = Effect.fn("triggers.schools.changeClassRole")(
  function* (
    memberId: Id<"schoolClassMembers">,
    member: Doc<"schoolClassMembers">,
    oldMember: Doc<"schoolClassMembers">
  ) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const classDoc = yield* database.table("schoolClasses").get(member.classId);
    const teacherDelta = member.role === "teacher" ? 1 : -1;
    yield* writer.table("schoolClasses").patch(member.classId, {
      teacherCount: Math.max(classDoc.teacherCount + teacherDelta, 0),
      studentCount: Math.max(classDoc.studentCount - teacherDelta, 0),
    });
    yield* writer.table("schoolActivityLogs").insert({
      schoolId: member.schoolId,
      userId: member.userId,
      action: "class_member_role_changed",
      entityType: "schoolClassMembers",
      entityId: memberId,
      metadata: {
        classId: member.classId,
        oldRole: oldMember.role,
        newRole: member.role,
      },
    });
  },
  Effect.orDie
);
