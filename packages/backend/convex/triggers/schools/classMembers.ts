import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import {
  handleRoleChange,
  updateClassMemberCount,
} from "@repo/backend/convex/triggers/helpers/classes";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

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
export async function schoolClassMembersHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schoolClassMembers">
) {
  const member = change.newDoc;
  const oldMember = change.oldDoc;

  switch (change.operation) {
    case "insert": {
      if (!member) {
        break;
      }

      if (member.inviteCodeId) {
        const inviteCode = await ctx.db.get(
          "schoolClassInviteCodes",
          member.inviteCodeId
        );
        if (inviteCode) {
          await ctx.db.patch("schoolClassInviteCodes", member.inviteCodeId, {
            currentUsage: inviteCode.currentUsage + 1,
            updatedAt: Date.now(),
          });
        }
      }

      await updateClassMemberCount(ctx, member.classId, member.role, 1);

      await ctx.db.insert("schoolActivityLogs", {
        schoolId: member.schoolId,
        userId: member.addedBy ?? member.userId,
        action: "class_member_added",
        entityType: "classMembers",
        entityId: change.id,
        metadata: {
          classId: member.classId,
          addedUserId: member.userId,
          role: member.role,
          teacherRole: member.teacherRole,
          enrollMethod: member.enrollMethod,
        },
      });
      break;
    }

    case "update": {
      if (!(member && oldMember)) {
        break;
      }

      if (oldMember.role !== member.role) {
        await handleRoleChange(ctx, change.id, member, oldMember);
      }

      if (
        oldMember.teacherRole !== member.teacherRole &&
        member.role === "teacher"
      ) {
        await ctx.db.insert("schoolActivityLogs", {
          schoolId: member.schoolId,
          userId: member.userId,
          action: "class_member_role_changed",
          entityType: "classMembers",
          entityId: change.id,
          metadata: {
            classId: member.classId,
            oldTeacherRole: oldMember.teacherRole,
            newTeacherRole: member.teacherRole,
          },
        });
      }
      break;
    }

    case "delete": {
      if (!oldMember) {
        break;
      }

      await updateClassMemberCount(ctx, oldMember.classId, oldMember.role, -1);

      await ctx.db.insert("schoolActivityLogs", {
        schoolId: oldMember.schoolId,
        userId: oldMember.removedBy ?? oldMember.userId,
        action: "class_member_removed",
        entityType: "classMembers",
        entityId: change.id,
        metadata: {
          classId: oldMember.classId,
          removedUserId: oldMember.userId,
          role: oldMember.role,
          removedAt: oldMember.removedAt,
        },
      });
      break;
    }

    default: {
      break;
    }
  }
}
