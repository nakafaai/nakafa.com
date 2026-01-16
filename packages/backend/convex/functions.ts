/**
 * Convex Triggers - Central trigger management
 *
 * INFINITE LOOP PREVENTION:
 * =========================
 * When trigger A modifies table B, table B MUST have a trigger registered.
 * If B doesn't need logic, register a no-op trigger to break the chain.
 *
 * DEPENDENCY GRAPH (verified safe):
 * - comments → comments (self-patch replyCount) → update case empty ✅
 * - comments → commentVotes (delete) → patches comments → update case empty ✅
 * - commentVotes → comments (patch counts) → update case empty ✅
 * - chats → messages, parts (delete) → no-op ✅
 * - schools → schoolActivityLogs (insert) → no-op ✅
 * - schoolMembers → schoolInviteCodes, schoolActivityLogs → no-op ✅
 * - schoolClasses → schoolActivityLogs, schoolClassMembers → no-op, delete context ✅
 * - schoolClassMembers → schoolClasses (patch counts) → update ignores counts ✅
 * - schoolClassForumPosts → schoolClassForums, notifications, notificationCounts → no-op ✅
 * - schoolClassForumPosts → schoolClassForumPosts (patch replyCount) → update empty ✅
 * - schoolClassForumPostReactions → schoolClassForumPosts (patch) → update empty ✅
 * - schoolClassForumReactions → schoolClassForums (patch) → no-op ✅
 * - schoolClassMaterialGroups → schoolClassMaterialGroups (children), schoolClassMaterials → cascades ✅
 * - schoolClassMaterials → schoolClassMaterialAttachments, schoolClassMaterialViews → no-op ✅
 *
 * RULE: Update cases should NOT trigger cascading modifications to avoid loops.
 */

import type {
  DataModel,
  Doc,
  Id,
} from "@repo/backend/convex/_generated/dataModel";
import type {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/convex/_generated/server";
import {
  internalMutation as rawInternalMutation,
  mutation as rawMutation,
} from "@repo/backend/convex/_generated/server";
import { applyAttemptAggregatesDelta } from "@repo/backend/convex/exercises/utils";
import { truncateText } from "@repo/backend/convex/utils/helper";
import type { WithoutSystemFields } from "convex/server";
import {
  customCtx,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";

const triggers = new Triggers<DataModel>();

export { triggers };

export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(
  rawInternalMutation,
  customCtx(triggers.wrapDB)
);

// =============================================================================
// NO-OP TRIGGERS
// Register no-op triggers for tables that are modified via wrapped ctx.db
// but don't need custom trigger logic. This prevents "is not iterable" errors.
// =============================================================================

// Chat-related tables
triggers.register("messages", async () => {
  // No-op: messages are deleted by the chats trigger
});

triggers.register("parts", async () => {
  // No-op: parts are deleted by the chats trigger and deletePartsForMessage helper
});

// School-related tables (modified in triggers)
triggers.register("schoolInviteCodes", async () => {
  // No-op: patched in schoolMembers trigger for usage tracking
});

triggers.register("schoolClassInviteCodes", async () => {
  // No-op: patched in schoolClassMembers trigger for usage tracking
});

triggers.register("schoolClassForums", async () => {
  // No-op: patched in schoolClassForumPosts trigger for post counts
});

triggers.register("schoolClassForumReadStates", async () => {
  // No-op: upserted in classes/mutations.ts for read tracking
});

triggers.register("schoolActivityLogs", async () => {
  // No-op: inserted by various triggers for audit logging
});

// Notification-related tables
triggers.register("notifications", async () => {
  // No-op: created by various triggers for user notifications
});

triggers.register("notificationCounts", async () => {
  // No-op: updated atomically when notifications are created/read
});

triggers.register("notificationPreferences", async () => {
  // No-op: modified in notifications/mutations.ts
});

// Material-related tables
triggers.register("schoolClassMaterialAttachments", async () => {
  // No-op: deleted by schoolClassMaterials trigger
});

triggers.register("schoolClassMaterialViews", async () => {
  // No-op: deleted by schoolClassMaterials trigger
});

// =============================================================================
// ACTIVE TRIGGERS
// =============================================================================

triggers.register("exerciseAnswers", async (ctx, change) => {
  const now = Date.now();
  const answer = change.newDoc;
  const oldAnswer = change.oldDoc;

  const applyDelta = async ({
    attemptId,
    deltaAnsweredCount,
    deltaCorrectAnswers,
    deltaTotalTime,
  }: {
    attemptId: Id<"exerciseAttempts">;
    deltaAnsweredCount: number;
    deltaCorrectAnswers: number;
    deltaTotalTime: number;
  }) => {
    const attempt = await ctx.db.get("exerciseAttempts", attemptId);
    if (!attempt) {
      return;
    }

    // Delta = how much the aggregates change for this write (retry-safe).
    const next = applyAttemptAggregatesDelta({
      attempt,
      deltaAnsweredCount,
      deltaCorrectAnswers,
      deltaTotalTime,
    });

    await ctx.db.patch("exerciseAttempts", attemptId, {
      ...next,
      lastActivityAt: now,
      updatedAt: now,
    });
  };

  const toDelta = (doc: Doc<"exerciseAnswers">) => ({
    deltaAnsweredCount: 1,
    deltaCorrectAnswers: doc.isCorrect ? 1 : 0,
    deltaTotalTime: doc.timeSpent,
  });

  const toNegativeDelta = (doc: Doc<"exerciseAnswers">) => ({
    deltaAnsweredCount: -1,
    deltaCorrectAnswers: doc.isCorrect ? -1 : 0,
    deltaTotalTime: -doc.timeSpent,
  });

  switch (change.operation) {
    case "insert": {
      if (!answer) {
        break;
      }
      await applyDelta({ attemptId: answer.attemptId, ...toDelta(answer) });
      break;
    }

    case "update": {
      if (!(answer && oldAnswer)) {
        break;
      }

      if (answer.attemptId !== oldAnswer.attemptId) {
        await applyDelta({
          attemptId: oldAnswer.attemptId,
          ...toNegativeDelta(oldAnswer),
        });
        await applyDelta({ attemptId: answer.attemptId, ...toDelta(answer) });
        break;
      }

      const deltaCorrectAnswers =
        (answer.isCorrect ? 1 : 0) - (oldAnswer.isCorrect ? 1 : 0);
      const deltaTotalTime = answer.timeSpent - oldAnswer.timeSpent;

      await applyDelta({
        attemptId: answer.attemptId,
        deltaAnsweredCount: 0,
        deltaCorrectAnswers,
        deltaTotalTime,
      });
      break;
    }

    case "delete": {
      if (!oldAnswer) {
        break;
      }
      await applyDelta({
        attemptId: oldAnswer.attemptId,
        ...toNegativeDelta(oldAnswer),
      });
      break;
    }

    default: {
      break;
    }
  }
});

triggers.register("comments", async (ctx, change) => {
  const comment = change.newDoc;
  const oldComment = change.oldDoc;

  switch (change.operation) {
    case "insert": {
      if (!comment?.parentId) {
        break;
      }

      // Increment parent's reply count
      const parentComment = await ctx.db.get("comments", comment.parentId);
      if (parentComment) {
        await ctx.db.patch("comments", comment.parentId, {
          replyCount: parentComment.replyCount + 1,
        });
      }
      break;
    }

    case "delete": {
      if (!oldComment) {
        break;
      }

      // Delete all votes for this comment
      const votes = await ctx.db
        .query("commentVotes")
        .withIndex("commentId_userId", (q) => q.eq("commentId", change.id))
        .collect();

      for (const vote of votes) {
        await ctx.db.delete("commentVotes", vote._id);
      }

      // Delete all replies (cascading)
      const replies = await ctx.db
        .query("comments")
        .withIndex("parentId", (q) => q.eq("parentId", change.id))
        .collect();

      for (const reply of replies) {
        await ctx.db.delete("comments", reply._id);
      }

      // Decrement parent's reply count
      if (oldComment.parentId) {
        const parentComment = await ctx.db.get("comments", oldComment.parentId);
        if (parentComment) {
          await ctx.db.patch("comments", oldComment.parentId, {
            replyCount: Math.max(parentComment.replyCount - 1, 0),
          });
        }
      }
      break;
    }

    default: {
      break;
    }
  }
});

// Trigger for comment votes - updates denormalized vote counts on comments
triggers.register("commentVotes", async (ctx, change) => {
  const vote = change.newDoc;
  const oldVote = change.oldDoc;

  switch (change.operation) {
    case "insert": {
      if (!vote) {
        break;
      }

      const comment = await ctx.db.get("comments", vote.commentId);
      if (comment) {
        if (vote.vote === 1) {
          await ctx.db.patch("comments", vote.commentId, {
            upvoteCount: comment.upvoteCount + 1,
          });
        } else if (vote.vote === -1) {
          await ctx.db.patch("comments", vote.commentId, {
            downvoteCount: comment.downvoteCount + 1,
          });
        }
      }
      break;
    }

    case "delete": {
      if (!oldVote) {
        break;
      }

      const comment = await ctx.db.get("comments", oldVote.commentId);
      if (comment) {
        if (oldVote.vote === 1) {
          await ctx.db.patch("comments", oldVote.commentId, {
            upvoteCount: Math.max(comment.upvoteCount - 1, 0),
          });
        } else if (oldVote.vote === -1) {
          await ctx.db.patch("comments", oldVote.commentId, {
            downvoteCount: Math.max(comment.downvoteCount - 1, 0),
          });
        }
      }
      break;
    }

    default: {
      break;
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
      .withIndex("messageId_order", (q) => q.eq("messageId", message._id))
      .collect();

    for (const part of parts) {
      await ctx.db.delete("parts", part._id);
    }

    await ctx.db.delete("messages", message._id);
  }
});

// Helper to build changed fields metadata for school updates
function buildSchoolChangesMetadata(
  oldSchool: Doc<"schools">,
  school: Doc<"schools">
): Record<string, string | undefined> | null {
  const fields = [
    "name",
    "email",
    "phone",
    "address",
    "city",
    "province",
    "type",
  ] as const;

  const changes: Record<string, string | undefined> = {
    schoolName: school.name,
  };
  let hasChanges = false;

  for (const field of fields) {
    if (oldSchool[field] !== school[field]) {
      hasChanges = true;
      const capitalized = field.charAt(0).toUpperCase() + field.slice(1);
      changes[`old${capitalized}`] = oldSchool[field];
      changes[`new${capitalized}`] = school[field];
    }
  }

  return hasChanges ? changes : null;
}

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
      const member = await ctx.db
        .query("schoolMembers")
        .withIndex("schoolId_userId", (q) =>
          q.eq("schoolId", schoolId).eq("userId", school.createdBy)
        )
        .first();
      const adminMember = member?.role === "admin" ? member : null;

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

      const changesMetadata = buildSchoolChangesMetadata(oldSchool, school);
      if (changesMetadata) {
        await ctx.db.insert("schoolActivityLogs", {
          schoolId,
          userId: school.updatedBy ?? school.createdBy,
          action: "school_updated",
          entityType: "schools",
          entityId: schoolId,
          metadata: changesMetadata,
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

// Helper to build changed fields metadata for class updates
function buildClassChangesMetadata(
  oldClassDoc: Doc<"schoolClasses">,
  classDoc: Doc<"schoolClasses">
): Record<string, string | number | undefined> | null {
  const fields = ["name", "subject", "year", "visibility"] as const;

  const changes: Record<string, string | number | undefined> = {
    className: classDoc.name,
  };
  let hasChanges = false;

  for (const field of fields) {
    if (oldClassDoc[field] !== classDoc[field]) {
      hasChanges = true;
      const capitalized = field.charAt(0).toUpperCase() + field.slice(1);
      changes[`old${capitalized}`] = oldClassDoc[field];
      changes[`new${capitalized}`] = classDoc[field];
    }
  }

  return hasChanges ? changes : null;
}

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
      const changesMetadata = buildClassChangesMetadata(oldClassDoc, classDoc);
      if (changesMetadata) {
        await ctx.db.insert("schoolActivityLogs", {
          schoolId: classDoc.schoolId,
          userId: classDoc.updatedBy ?? classDoc.createdBy,
          action: "class_updated",
          entityType: "classes",
          entityId: classId,
          metadata: changesMetadata,
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
        .withIndex("classId_userId", (q) => q.eq("classId", classId))
        .collect();

      for (const member of classMembers) {
        await ctx.db.delete("schoolClassMembers", member._id);
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

// Trigger for forum posts - updates forum stats, reply counts, read state, and creates notifications
triggers.register("schoolClassForumPosts", async (ctx, change) => {
  const post = change.newDoc;
  const oldPost = change.oldDoc;

  switch (change.operation) {
    case "insert": {
      if (!post) {
        break;
      }

      // Get forum for context
      const forum = await ctx.db.get("schoolClassForums", post.forumId);
      if (forum) {
        // Update forum stats
        await ctx.db.patch("schoolClassForums", post.forumId, {
          postCount: forum.postCount + 1,
          lastPostAt: post._creationTime,
          lastPostBy: post.createdBy,
          updatedAt: Date.now(),
        });

        // === READ STATE ===
        // Update author's read state so own messages are not shown as unread
        // Use _creationTime to match lastPostAt exactly (prevents flash of unread)
        await updateForumReadState(ctx, {
          forumId: post.forumId,
          classId: post.classId,
          userId: post.createdBy,
          lastReadAt: post._creationTime,
        });

        // === NOTIFICATIONS ===
        const truncatedBody = truncateText({ text: post.body });

        // 1. Notify parent post author (post_reply) - don't notify yourself
        if (
          post.parentId &&
          post.replyToUserId &&
          post.replyToUserId !== post.createdBy
        ) {
          await createNotification(ctx, {
            recipientId: post.replyToUserId,
            actorId: post.createdBy,
            type: "post_reply",
            entityType: "schoolClassForumPosts",
            entityId: change.id,
            previewTitle: forum.title,
            previewBody: truncatedBody,
          });
        }

        // 2. Notify mentioned users (post_mention)
        if (post.mentions.length > 0) {
          for (const mentionedUserId of post.mentions) {
            // Don't notify yourself or the person you're already replying to
            if (
              mentionedUserId !== post.createdBy &&
              mentionedUserId !== post.replyToUserId
            ) {
              await createNotification(ctx, {
                recipientId: mentionedUserId,
                actorId: post.createdBy,
                type: "post_mention",
                entityType: "schoolClassForumPosts",
                entityId: change.id,
                previewTitle: forum.title,
                previewBody: truncatedBody,
              });
            }
          }
        }
      }

      // Update parent post reply count
      if (post.parentId) {
        const parentPost = await ctx.db.get(
          "schoolClassForumPosts",
          post.parentId
        );
        if (parentPost) {
          await ctx.db.patch("schoolClassForumPosts", post.parentId, {
            replyCount: parentPost.replyCount + 1,
            updatedAt: Date.now(),
          });
        }
      }
      break;
    }

    case "delete": {
      if (!oldPost) {
        break;
      }

      const forum = await ctx.db.get("schoolClassForums", oldPost.forumId);
      if (forum) {
        await ctx.db.patch("schoolClassForums", oldPost.forumId, {
          postCount: Math.max(forum.postCount - 1, 0),
          updatedAt: Date.now(),
        });
      }

      if (oldPost.parentId) {
        const parentPost = await ctx.db.get(
          "schoolClassForumPosts",
          oldPost.parentId
        );
        if (parentPost) {
          await ctx.db.patch("schoolClassForumPosts", oldPost.parentId, {
            replyCount: Math.max(parentPost.replyCount - 1, 0),
            updatedAt: Date.now(),
          });
        }
      }
      break;
    }

    default: {
      break;
    }
  }
});

// Trigger for forum post reactions - updates denormalized reaction counts on posts
triggers.register("schoolClassForumPostReactions", async (ctx, change) => {
  const reaction = change.newDoc;
  const oldReaction = change.oldDoc;

  switch (change.operation) {
    case "insert": {
      if (!reaction) {
        break;
      }

      const post = await ctx.db.get("schoolClassForumPosts", reaction.postId);
      if (post) {
        const reactionCounts = [...post.reactionCounts];
        const existingIndex = reactionCounts.findIndex(
          (r) => r.emoji === reaction.emoji
        );

        if (existingIndex >= 0) {
          reactionCounts[existingIndex] = {
            emoji: reaction.emoji,
            count: reactionCounts[existingIndex].count + 1,
          };
        } else {
          reactionCounts.push({ emoji: reaction.emoji, count: 1 });
        }

        await ctx.db.patch("schoolClassForumPosts", reaction.postId, {
          reactionCounts,
        });
      }
      break;
    }

    case "delete": {
      if (!oldReaction) {
        break;
      }

      const post = await ctx.db.get(
        "schoolClassForumPosts",
        oldReaction.postId
      );
      if (post) {
        const reactionCounts = [...post.reactionCounts];
        const existingIndex = reactionCounts.findIndex(
          (r) => r.emoji === oldReaction.emoji
        );

        if (existingIndex >= 0) {
          const newCount = reactionCounts[existingIndex].count - 1;
          if (newCount <= 0) {
            reactionCounts.splice(existingIndex, 1);
          } else {
            reactionCounts[existingIndex] = {
              emoji: oldReaction.emoji,
              count: newCount,
            };
          }
          await ctx.db.patch("schoolClassForumPosts", oldReaction.postId, {
            reactionCounts,
          });
        }
      }
      break;
    }

    default: {
      break;
    }
  }
});

// Trigger for forum reactions - updates denormalized reaction counts on forums
triggers.register("schoolClassForumReactions", async (ctx, change) => {
  const reaction = change.newDoc;
  const oldReaction = change.oldDoc;

  switch (change.operation) {
    case "insert": {
      if (!reaction) {
        break;
      }

      const forum = await ctx.db.get("schoolClassForums", reaction.forumId);
      if (forum) {
        const reactionCounts = [...forum.reactionCounts];
        const existingIndex = reactionCounts.findIndex(
          (r) => r.emoji === reaction.emoji
        );

        if (existingIndex >= 0) {
          reactionCounts[existingIndex] = {
            emoji: reaction.emoji,
            count: reactionCounts[existingIndex].count + 1,
          };
        } else {
          reactionCounts.push({ emoji: reaction.emoji, count: 1 });
        }

        await ctx.db.patch("schoolClassForums", reaction.forumId, {
          reactionCounts,
        });
      }
      break;
    }

    case "delete": {
      if (!oldReaction) {
        break;
      }

      const forum = await ctx.db.get("schoolClassForums", oldReaction.forumId);
      if (forum) {
        const reactionCounts = [...forum.reactionCounts];
        const existingIndex = reactionCounts.findIndex(
          (r) => r.emoji === oldReaction.emoji
        );

        if (existingIndex >= 0) {
          const newCount = reactionCounts[existingIndex].count - 1;
          if (newCount <= 0) {
            reactionCounts.splice(existingIndex, 1);
          } else {
            reactionCounts[existingIndex] = {
              emoji: oldReaction.emoji,
              count: newCount,
            };
          }
          await ctx.db.patch("schoolClassForums", oldReaction.forumId, {
            reactionCounts,
          });
        }
      }
      break;
    }

    default: {
      break;
    }
  }
});

// Trigger for materials - cascades delete to attachments and views
triggers.register("schoolClassMaterials", async (ctx, change) => {
  const oldMaterial = change.oldDoc;

  switch (change.operation) {
    case "delete": {
      if (!oldMaterial) {
        break;
      }

      // Delete all attachments for this material
      const attachments = await ctx.db
        .query("schoolClassMaterialAttachments")
        .withIndex("materialId_type_order", (q) =>
          q.eq("materialId", change.id)
        )
        .collect();

      for (const attachment of attachments) {
        // Delete the file from storage
        await ctx.storage.delete(attachment.fileId);
        await ctx.db.delete("schoolClassMaterialAttachments", attachment._id);
      }

      // Delete all view records for this material
      const views = await ctx.db
        .query("schoolClassMaterialViews")
        .withIndex("materialId_userId", (q) => q.eq("materialId", change.id))
        .collect();

      for (const view of views) {
        await ctx.db.delete("schoolClassMaterialViews", view._id);
      }
      break;
    }

    default: {
      break;
    }
  }
});

// Trigger for material groups - cascades delete to children and materials
triggers.register("schoolClassMaterialGroups", async (ctx, change) => {
  const oldGroup = change.oldDoc;

  switch (change.operation) {
    case "delete": {
      if (!oldGroup) {
        break;
      }

      // Cancel scheduled job if exists
      if (oldGroup.scheduledJobId) {
        await ctx.scheduler.cancel(oldGroup.scheduledJobId);
      }

      // Delete all child groups (recursive via trigger)
      const childGroups = await ctx.db
        .query("schoolClassMaterialGroups")
        .withIndex("classId_parentId_order", (q) =>
          q.eq("classId", oldGroup.classId).eq("parentId", change.id)
        )
        .collect();

      for (const child of childGroups) {
        await ctx.db.delete("schoolClassMaterialGroups", child._id);
      }

      // Delete all materials in this group (cascades to attachments/views via trigger)
      const materials = await ctx.db
        .query("schoolClassMaterials")
        .withIndex("groupId_status_isPinned_order", (q) =>
          q.eq("groupId", change.id)
        )
        .collect();

      for (const material of materials) {
        await ctx.db.delete("schoolClassMaterials", material._id);
      }

      // Update parent's childGroupCount
      if (oldGroup.parentId) {
        const parent = await ctx.db.get(
          "schoolClassMaterialGroups",
          oldGroup.parentId
        );
        if (parent) {
          await ctx.db.patch("schoolClassMaterialGroups", oldGroup.parentId, {
            childGroupCount: Math.max(0, parent.childGroupCount - 1),
            updatedAt: Date.now(),
          });
        }
      }
      break;
    }

    default: {
      break;
    }
  }
});

// =============================================================================
// CLASS MEMBER HELPERS
// =============================================================================

async function updateClassMemberCount(
  ctx: { db: DatabaseReader & DatabaseWriter },
  classId: Id<"schoolClasses">,
  role: "teacher" | "student",
  delta: number
) {
  const classDoc = await ctx.db.get("schoolClasses", classId);
  if (!classDoc) {
    return;
  }

  if (role === "teacher") {
    await ctx.db.patch("schoolClasses", classId, {
      teacherCount: Math.max(classDoc.teacherCount + delta, 0),
    });
  } else if (role === "student") {
    await ctx.db.patch("schoolClasses", classId, {
      studentCount: Math.max(classDoc.studentCount + delta, 0),
    });
  }
}

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
  const classDoc = await ctx.db.get("schoolClasses", member.classId);
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

    await ctx.db.patch("schoolClasses", member.classId, {
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

// =============================================================================
// FORUM HELPERS
// =============================================================================

/**
 * Helper function to update forum read state (upsert pattern)
 *
 * Updates the lastReadAt timestamp for a user's forum read state.
 * Creates a new record if one doesn't exist.
 * Uses "high water mark" pattern: only updates if new value is greater.
 */
async function updateForumReadState(
  ctx: { db: DatabaseReader & DatabaseWriter },
  args: {
    forumId: Id<"schoolClassForums">;
    classId: Id<"schoolClasses">;
    userId: Id<"users">;
    lastReadAt: number;
  }
) {
  const existing = await ctx.db
    .query("schoolClassForumReadStates")
    .withIndex("forumId_userId", (q) =>
      q.eq("forumId", args.forumId).eq("userId", args.userId)
    )
    .unique();

  if (existing) {
    // High water mark: only update if moving forward in time
    if (args.lastReadAt > existing.lastReadAt) {
      await ctx.db.patch("schoolClassForumReadStates", existing._id, {
        lastReadAt: args.lastReadAt,
      });
    }
  } else {
    await ctx.db.insert("schoolClassForumReadStates", {
      forumId: args.forumId,
      classId: args.classId,
      userId: args.userId,
      lastReadAt: args.lastReadAt,
    });
  }
}

// =============================================================================
// NOTIFICATION HELPERS
// =============================================================================

/**
 * Helper function to create a notification and update unread count
 *
 * This is the central place for creating notifications.
 * It handles:
 * 1. Creating the notification record (readAt = undefined means unread)
 * 2. Updating the denormalized unread count
 *
 * Navigation URL is built at READ TIME by fetching the entity:
 * - Post → post.forumId → forum.classId → class.schoolId → school.slug
 * - Comment → comment.slug
 * This ensures URLs are always correct even if routing changes.
 *
 * Future enhancements:
 * - Check user preferences (disabledTypes, mutedEntities)
 * - Send push notifications
 * - Send email notifications based on digest settings
 */
async function createNotification(
  ctx: { db: DatabaseReader & DatabaseWriter },
  args: Omit<WithoutSystemFields<Doc<"notifications">>, "readAt">
) {
  // Create notification (readAt undefined = unread)
  await ctx.db.insert("notifications", {
    recipientId: args.recipientId,
    actorId: args.actorId,
    type: args.type,
    entityType: args.entityType,
    entityId: args.entityId,
    previewTitle: args.previewTitle,
    previewBody: args.previewBody,
  });

  // Update unread count (upsert pattern)
  const existingCount = await ctx.db
    .query("notificationCounts")
    .withIndex("userId", (q) => q.eq("userId", args.recipientId))
    .unique();

  if (existingCount) {
    await ctx.db.patch("notificationCounts", existingCount._id, {
      unreadCount: existingCount.unreadCount + 1,
      updatedAt: Date.now(),
    });
  } else {
    await ctx.db.insert("notificationCounts", {
      userId: args.recipientId,
      unreadCount: 1,
      updatedAt: Date.now(),
    });
  }
}
