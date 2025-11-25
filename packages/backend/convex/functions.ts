import {
  customCtx,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";
import type { DataModel } from "./_generated/dataModel";
import {
  internalMutation as rawInternalMutation,
  mutation as rawMutation,
} from "./_generated/server";

const triggers = new Triggers<DataModel>();

export { triggers };

export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(
  rawInternalMutation,
  customCtx(triggers.wrapDB)
);

// This is a trigger that deletes all votes and replies when a comment is deleted.
triggers.register("comments", async (ctx, change) => {
  if (change.operation !== "delete") {
    return;
  }

  const votes = await ctx.db
    .query("commentVotes")
    .withIndex("commentId", (q) => q.eq("commentId", change.id))
    .collect();

  for (const vote of votes) {
    await ctx.db.delete(vote._id);
  }

  const replies = await ctx.db
    .query("comments")
    .withIndex("parentId", (q) => q.eq("parentId", change.id))
    .collect();

  for (const reply of replies) {
    await ctx.db.delete(reply._id);
  }

  if (change.oldDoc.parentId) {
    const parentComment = await ctx.db.get(change.oldDoc.parentId);
    if (parentComment) {
      await ctx.db.patch(change.oldDoc.parentId, {
        replyCount: Math.max(parentComment.replyCount - 1, 0),
      });
    }
  }
});

// This is a trigger that deletes all messages and parts when a chat is deleted.
triggers.register("chats", async (ctx, change) => {
  if (change.operation !== "delete") {
    return;
  }

  // Get all messages for this chat
  const messages = await ctx.db
    .query("messages")
    .withIndex("chatId", (q) => q.eq("chatId", change.id))
    .collect();

  // Delete all parts for each message, then delete the messages
  for (const message of messages) {
    const parts = await ctx.db
      .query("parts")
      .withIndex("messageId", (q) => q.eq("messageId", message._id))
      .collect();

    for (const part of parts) {
      await ctx.db.delete(part._id);
    }

    await ctx.db.delete(message._id);
  }
});

// This is a trigger that creates activity logs when a school is created, updated, or deleted.
triggers.register("schools", async (ctx, change) => {
  const school = change.newDoc;
  const oldSchool = change.oldDoc;
  const schoolId = change.id;

  switch (change.operation) {
    case "insert": {
      if (!school) {
        break;
      }

      // Find the admin member for this school (creator becomes admin)
      const adminMember = await ctx.db
        .query("schoolMembers")
        .withIndex("schoolId_userId", (q) =>
          q.eq("schoolId", schoolId).eq("userId", school.createdBy)
        )
        .filter((q) => q.eq(q.field("role"), "admin"))
        .first();

      // Create activity log entry
      await ctx.db.insert("activityLogs", {
        schoolId,
        userId: school.createdBy,
        action: "school_created",
        entityType: "schools",
        entityId: schoolId,
        metadata: {
          schoolName: school.name,
          memberId: adminMember?._id,
        },
      });
      break;
    }

    case "update": {
      if (!(school && oldSchool)) {
        break;
      }

      // Create activity log entry for school update
      await ctx.db.insert("activityLogs", {
        schoolId,
        userId: school.updatedBy ?? school.createdBy,
        action: "school_updated",
        entityType: "schools",
        entityId: schoolId,
        metadata: {
          schoolName: school.name,
        },
      });
      break;
    }

    case "delete": {
      if (!oldSchool) {
        break;
      }

      // Create activity log entry for school deletion
      await ctx.db.insert("activityLogs", {
        schoolId,
        userId: oldSchool.updatedBy ?? oldSchool.createdBy,
        action: "school_deleted",
        entityType: "schools",
        entityId: schoolId,
        metadata: {
          schoolName: oldSchool.name,
        },
      });
      break;
    }

    default: {
      // Other operations don't need logging
      break;
    }
  }
});

// This is a trigger that creates activity logs when school members are added, updated, or removed.
triggers.register("schoolMembers", async (ctx, change) => {
  const member = change.newDoc;
  const oldMember = change.oldDoc;

  switch (change.operation) {
    case "insert": {
      if (!member) {
        break;
      }

      switch (member.status) {
        case "active": {
          // Member joined the school
          await ctx.db.insert("activityLogs", {
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
          // Member was invited
          await ctx.db.insert("activityLogs", {
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
          // Other statuses don't need logging
          break;
        }
      }
      break;
    }

    case "update": {
      if (!(member && oldMember)) {
        break;
      }

      // Check if role changed
      if (oldMember.role !== member.role) {
        await ctx.db.insert("activityLogs", {
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

      // Check status changes
      const statusTransition = `${oldMember.status}-${member.status}` as const;
      switch (statusTransition) {
        case "invited-active": {
          // Member accepted invitation
          await ctx.db.insert("activityLogs", {
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
          // Check if status changed to "removed"
          if (oldMember.status !== "removed" && member.status === "removed") {
            await ctx.db.insert("activityLogs", {
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

      await ctx.db.insert("activityLogs", {
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
      // Other operations don't need logging
      break;
    }
  }
});
