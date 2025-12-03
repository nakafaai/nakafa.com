/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Triggers are complex */
import {
  customCtx,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";
import type { DataModel, Id } from "./_generated/dataModel";
import type { DatabaseReader, DatabaseWriter } from "./_generated/server";
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
      await ctx.db.insert("schoolActivityLogs", {
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

      // General school update
      if (
        oldSchool.name !== school.name ||
        oldSchool.email !== school.email ||
        oldSchool.phone !== school.phone ||
        oldSchool.address !== school.address ||
        oldSchool.city !== school.city ||
        oldSchool.province !== school.province ||
        oldSchool.type !== school.type
      ) {
        await ctx.db.insert("schoolActivityLogs", {
          schoolId,
          userId: school.updatedBy ?? school.createdBy,
          action: "school_updated",
          entityType: "schools",
          entityId: schoolId,
          metadata: {
            schoolName: school.name,
            oldName:
              oldSchool.name !== school.name ? oldSchool.name : undefined,
            newName: oldSchool.name !== school.name ? school.name : undefined,
            oldEmail:
              oldSchool.email !== school.email ? oldSchool.email : undefined,
            newEmail:
              oldSchool.email !== school.email ? school.email : undefined,
            oldPhone:
              oldSchool.phone !== school.phone ? oldSchool.phone : undefined,
            newPhone:
              oldSchool.phone !== school.phone ? school.phone : undefined,
            oldAddress:
              oldSchool.address !== school.address
                ? oldSchool.address
                : undefined,
            newAddress:
              oldSchool.address !== school.address ? school.address : undefined,
            oldCity:
              oldSchool.city !== school.city ? oldSchool.city : undefined,
            newCity: oldSchool.city !== school.city ? school.city : undefined,
            oldProvince:
              oldSchool.province !== school.province
                ? oldSchool.province
                : undefined,
            newProvince:
              oldSchool.province !== school.province
                ? school.province
                : undefined,
            oldType:
              oldSchool.type !== school.type ? oldSchool.type : undefined,
            newType: oldSchool.type !== school.type ? school.type : undefined,
          },
        });
      }
      break;
    }

    case "delete": {
      if (!oldSchool) {
        break;
      }

      // Create activity log entry for school deletion
      await ctx.db.insert("schoolActivityLogs", {
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

      // Update invite code usage count if member joined via invite code
      if (member.inviteCodeId) {
        const inviteCode = await ctx.db.get(member.inviteCodeId);
        if (inviteCode) {
          await ctx.db.patch(member.inviteCodeId, {
            currentUsage: inviteCode.currentUsage + 1,
            updatedAt: Date.now(),
          });
        }
      }

      switch (member.status) {
        case "active": {
          // Member joined the school
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
          // Member was invited
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

      // Check status changes
      const statusTransition = `${oldMember.status}-${member.status}` as const;
      switch (statusTransition) {
        case "invited-active": {
          // Member accepted invitation
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
          // Check if status changed to "removed"
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
      // Other operations don't need logging
      break;
    }
  }
});

// This is a trigger that creates activity logs when a class is created, updated, archived, or deleted.
triggers.register("schoolClasses", async (ctx, change) => {
  const classDoc = change.newDoc;
  const oldClassDoc = change.oldDoc;
  const classId = change.id;

  switch (change.operation) {
    case "insert": {
      if (!classDoc) {
        break;
      }

      // Create activity log for class creation
      await ctx.db.insert("schoolActivityLogs", {
        schoolId: classDoc.schoolId,
        userId: classDoc.createdBy,
        action: "class_created",
        entityType: "classes",
        entityId: classId,
        metadata: {
          className: classDoc.name,
          subject: classDoc.subject,
          year: classDoc.year,
        },
      });
      break;
    }

    case "update": {
      if (!(classDoc && oldClassDoc)) {
        break;
      }

      // Check if class was archived/unarchived
      if (oldClassDoc.isArchived !== classDoc.isArchived) {
        await ctx.db.insert("schoolActivityLogs", {
          schoolId: classDoc.schoolId,
          userId:
            classDoc.archivedBy ?? classDoc.updatedBy ?? classDoc.createdBy,
          action: "class_archived",
          entityType: "classes",
          entityId: classId,
          metadata: {
            className: classDoc.name,
            isArchived: classDoc.isArchived,
            archivedAt: classDoc.archivedAt,
          },
        });
      }

      // General class update
      if (
        oldClassDoc.name !== classDoc.name ||
        oldClassDoc.subject !== classDoc.subject ||
        oldClassDoc.year !== classDoc.year
      ) {
        await ctx.db.insert("schoolActivityLogs", {
          schoolId: classDoc.schoolId,
          userId: classDoc.updatedBy ?? classDoc.createdBy,
          action: "class_updated",
          entityType: "classes",
          entityId: classId,
          metadata: {
            className: classDoc.name,
            oldName:
              oldClassDoc.name !== classDoc.name ? oldClassDoc.name : undefined,
            newName:
              oldClassDoc.name !== classDoc.name ? classDoc.name : undefined,
            oldSubject:
              oldClassDoc.subject !== classDoc.subject
                ? oldClassDoc.subject
                : undefined,
            newSubject:
              oldClassDoc.subject !== classDoc.subject
                ? classDoc.subject
                : undefined,
            oldYear:
              oldClassDoc.year !== classDoc.year ? oldClassDoc.year : undefined,
            newYear:
              oldClassDoc.year !== classDoc.year ? classDoc.year : undefined,
          },
        });
      }
      break;
    }

    case "delete": {
      if (!oldClassDoc) {
        break;
      }

      // Create activity log for class deletion
      await ctx.db.insert("schoolActivityLogs", {
        schoolId: oldClassDoc.schoolId,
        userId: oldClassDoc.updatedBy ?? oldClassDoc.createdBy,
        action: "class_deleted",
        entityType: "classes",
        entityId: classId,
        metadata: {
          className: oldClassDoc.name,
          subject: oldClassDoc.subject,
          year: oldClassDoc.year,
        },
      });

      // Clean up: Delete all class members
      const classMembers = await ctx.db
        .query("schoolClassMembers")
        .withIndex("classId", (q) => q.eq("classId", classId))
        .collect();

      for (const member of classMembers) {
        await ctx.db.delete(member._id);
      }
      break;
    }

    default: {
      break;
    }
  }
});

// This is a trigger that manages class member activity logs and updates denormalized counts.
triggers.register("schoolClassMembers", async (ctx, change) => {
  const member = change.newDoc;
  const oldMember = change.oldDoc;

  switch (change.operation) {
    case "insert": {
      if (!member) {
        break;
      }

      // Update invite code usage count if member joined via invite code
      if (member.inviteCodeId) {
        const inviteCode = await ctx.db.get(member.inviteCodeId);
        if (inviteCode) {
          await ctx.db.patch(member.inviteCodeId, {
            currentUsage: inviteCode.currentUsage + 1,
            updatedAt: Date.now(),
          });
        }
      }

      // Update denormalized counts
      await updateClassMemberCount(ctx, member.classId, member.role, 1);

      // Create activity log
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

      // Handle role change
      if (oldMember.role !== member.role) {
        await handleRoleChange(ctx, change.id, member, oldMember);
      }

      // Handle teacher role change (primary -> co-teacher, etc.)
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

      // Handle permissions change
      if (
        JSON.stringify(oldMember.teacherPermissions) !==
        JSON.stringify(member.teacherPermissions)
      ) {
        await ctx.db.insert("schoolActivityLogs", {
          schoolId: member.schoolId,
          userId: member.userId,
          action: "class_member_permissions_changed",
          entityType: "classMembers",
          entityId: change.id,
          metadata: {
            classId: member.classId,
            oldPermissions: oldMember.teacherPermissions,
            newPermissions: member.teacherPermissions,
          },
        });
      }
      break;
    }

    case "delete": {
      if (!oldMember) {
        break;
      }

      // Update denormalized counts
      await updateClassMemberCount(ctx, oldMember.classId, oldMember.role, -1);

      // Create activity log
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
});

// Helper function to update class member counts
async function updateClassMemberCount(
  ctx: { db: DatabaseReader & DatabaseWriter },
  classId: Id<"schoolClasses">,
  role: "teacher" | "student",
  delta: number
) {
  const classDoc = await ctx.db.get(classId);
  if (!classDoc) {
    return;
  }

  if (role === "teacher") {
    await ctx.db.patch(classId, {
      teacherCount: Math.max(classDoc.teacherCount + delta, 0),
    });
  } else if (role === "student") {
    await ctx.db.patch(classId, {
      studentCount: Math.max(classDoc.studentCount + delta, 0),
    });
  }
}

// Helper function to handle role changes
async function handleRoleChange(
  ctx: { db: DatabaseReader & DatabaseWriter },
  memberId: Id<"schoolClassMembers">,
  member: {
    classId: Id<"schoolClasses">;
    schoolId: Id<"schools">;
    userId: Id<"users">;
    role: "teacher" | "student";
  },
  oldMember: { role: "teacher" | "student" }
) {
  // Update counts
  const classDoc = await ctx.db.get(member.classId);
  if (classDoc) {
    let teacherDelta = 0;
    let studentDelta = 0;

    if (oldMember.role === "teacher" && member.role === "student") {
      teacherDelta = -1;
      studentDelta = 1;
    } else if (oldMember.role === "student" && member.role === "teacher") {
      teacherDelta = 1;
      studentDelta = -1;
    }

    await ctx.db.patch(member.classId, {
      teacherCount: Math.max(classDoc.teacherCount + teacherDelta, 0),
      studentCount: Math.max(classDoc.studentCount + studentDelta, 0),
    });
  }

  // Log the change
  await ctx.db.insert("schoolActivityLogs", {
    schoolId: member.schoolId,
    userId: member.userId,
    action: "class_member_role_changed",
    entityType: "classMembers",
    entityId: memberId,
    metadata: {
      classId: member.classId,
      oldRole: oldMember.role,
      newRole: member.role,
    },
  });
}
