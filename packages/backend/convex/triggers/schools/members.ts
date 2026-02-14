import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Trigger handler for schoolMembers table changes.
 *
 * Manages school membership lifecycle and invite code tracking:
 * - Tracks invite code usage when members join via invite
 * - Logs member joins, invitations, role changes, and removals
 * - Handles status transitions (invited → active → removed)
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export async function schoolMembersHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schoolMembers">
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
          "schoolInviteCodes",
          member.inviteCodeId
        );
        if (inviteCode) {
          await ctx.db.patch("schoolInviteCodes", member.inviteCodeId, {
            currentUsage: inviteCode.currentUsage + 1,
            updatedAt: Date.now(),
          });
        }
      }

      switch (member.status) {
        case "active": {
          await ctx.db.insert("schoolActivityLogs", {
            schoolId: member.schoolId,
            userId: member.userId,
            action: "member_joined",
            entityType: "schoolMembers",
            entityId: change.id,
            metadata: {
              role: member.role,
              joinedAt: member.joinedAt,
            },
          });
          break;
        }
        case "invited": {
          await ctx.db.insert("schoolActivityLogs", {
            schoolId: member.schoolId,
            userId: member.invitedBy ?? member.userId,
            action: "member_invited",
            entityType: "schoolMembers",
            entityId: change.id,
            metadata: {
              invitedUserId: member.userId,
              role: member.role,
              invitedAt: member.invitedAt,
            },
          });
          break;
        }
        default: {
          break;
        }
      }
      break;
    }

    case "update": {
      if (!(member && oldMember)) {
        break;
      }

      if (oldMember.role !== member.role) {
        await ctx.db.insert("schoolActivityLogs", {
          schoolId: member.schoolId,
          userId: member.userId,
          action: "member_role_changed",
          entityType: "schoolMembers",
          entityId: change.id,
          metadata: {
            oldRole: oldMember.role,
            newRole: member.role,
          },
        });
      }

      const statusTransition = `${oldMember.status}-${member.status}` as const;
      switch (statusTransition) {
        case "invited-active": {
          await ctx.db.insert("schoolActivityLogs", {
            schoolId: member.schoolId,
            userId: member.userId,
            action: "member_joined",
            entityType: "schoolMembers",
            entityId: change.id,
            metadata: {
              role: member.role,
              joinedAt: member.joinedAt,
            },
          });
          break;
        }
        default: {
          if (oldMember.status !== "removed" && member.status === "removed") {
            await ctx.db.insert("schoolActivityLogs", {
              schoolId: member.schoolId,
              userId: member.removedBy ?? member.userId,
              action: "member_removed",
              entityType: "schoolMembers",
              entityId: change.id,
              metadata: {
                removedUserId: member.userId,
                role: member.role,
                removedAt: member.removedAt,
              },
            });
          }
          break;
        }
      }
      break;
    }

    case "delete": {
      if (!oldMember) {
        break;
      }

      await ctx.db.insert("schoolActivityLogs", {
        schoolId: oldMember.schoolId,
        userId: oldMember.userId,
        action: "member_removed",
        entityType: "schoolMembers",
        entityId: change.id,
        metadata: {
          removedUserId: oldMember.userId,
          role: oldMember.role,
        },
      });
      break;
    }
    default: {
      break;
    }
  }
}
