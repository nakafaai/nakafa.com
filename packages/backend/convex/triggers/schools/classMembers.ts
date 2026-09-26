import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  handleRoleChange,
  updateClassMemberCount,
} from "@repo/backend/convex/triggers/helpers/classes";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";
import { Effect, Struct } from "effect";

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
const recordClassMember = Effect.fn("triggers.schools.recordClassMember")(
  function* (
    ctx: GenericMutationCtx<DataModel>,
    change: Change<DataModel, "schoolClassMembers">
  ) {
    // biome-ignore lint/style/useDefaultSwitchClause: Convex Change is a closed union checked by TypeScript.
    switch (change.operation) {
      case "insert": {
        const member = change.newDoc;

        if (member.inviteCodeId) {
          const inviteCodeId = member.inviteCodeId;
          const inviteCode = yield* Effect.promise(() =>
            ctx.db.get("schoolClassInviteCodes", inviteCodeId)
          );
          if (inviteCode) {
            yield* Effect.promise(() =>
              ctx.db.patch("schoolClassInviteCodes", inviteCodeId, {
                currentUsage: inviteCode.currentUsage + 1,
                updatedAt: Date.now(),
              })
            );
          }
        }

        yield* Effect.promise(() =>
          updateClassMemberCount(ctx, member.classId, member.role, 1)
        );

        yield* Effect.promise(() =>
          ctx.db.insert("schoolActivityLogs", {
            schoolId: member.schoolId,
            userId: member.addedBy ?? member.userId,
            action: "class_member_added",
            entityType: "schoolClassMembers",
            entityId: change.id,
            metadata: {
              classId: member.classId,
              addedUserId: member.userId,
              role: member.role,
              ...Struct.pick(member, ["teacherRole", "enrollMethod"]),
            },
          })
        );
        break;
      }

      case "update": {
        const member = change.newDoc;
        const oldMember = change.oldDoc;

        if (oldMember.role !== member.role) {
          yield* Effect.promise(() =>
            handleRoleChange(ctx, change.id, member, oldMember)
          );
        }

        if (
          oldMember.teacherRole !== member.teacherRole &&
          member.role === "teacher"
        ) {
          yield* Effect.promise(() =>
            ctx.db.insert("schoolActivityLogs", {
              schoolId: member.schoolId,
              userId: member.userId,
              action: "class_member_teacher_role_changed",
              entityType: "schoolClassMembers",
              entityId: change.id,
              metadata: {
                classId: member.classId,
                ...Struct.renameKeys(Struct.pick(oldMember, ["teacherRole"]), {
                  teacherRole: "oldTeacherRole",
                }),
                ...Struct.renameKeys(Struct.pick(member, ["teacherRole"]), {
                  teacherRole: "newTeacherRole",
                }),
              },
            })
          );
        }
        break;
      }

      case "delete": {
        const oldMember = change.oldDoc;

        yield* Effect.promise(() =>
          updateClassMemberCount(ctx, oldMember.classId, oldMember.role, -1)
        );

        yield* Effect.promise(() =>
          ctx.db.insert("schoolActivityLogs", {
            schoolId: oldMember.schoolId,
            userId: oldMember.removedBy ?? oldMember.userId,
            action: "class_member_removed",
            entityType: "schoolClassMembers",
            entityId: change.id,
            metadata: {
              classId: oldMember.classId,
              removedUserId: oldMember.userId,
              role: oldMember.role,
              ...Struct.pick(oldMember, ["removedAt"]),
            },
          })
        );
        break;
      }
    }
  }
);

/** Convex trigger boundary, preserving atomic writes within its mutation. */
export function schoolClassMembersHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schoolClassMembers">
) {
  return runConvexProgram(recordClassMember(ctx, change));
}
