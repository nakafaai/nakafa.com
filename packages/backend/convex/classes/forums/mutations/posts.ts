import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  loadForumWithAccess,
  loadOpenForumWithAccess,
} from "@repo/backend/convex/classes/forums/utils/access";
import {
  MAX_FORUM_POST_ATTACHMENTS,
  MAX_FORUM_POST_MENTIONS,
} from "@repo/backend/convex/classes/forums/utils/constants";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import { isAdmin } from "@repo/backend/convex/lib/helpers/school";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { updateForumReadState } from "@repo/backend/convex/triggers/helpers/forums";
import { truncateText } from "@repo/backend/convex/utils/helper";
import { ConvexError, type Infer, v } from "convex/values";

const attachmentArg = v.object({
  name: v.string(),
  size: v.number(),
  storageId: v.id("_storage"),
  type: v.string(),
});

export type AttachmentArg = Infer<typeof attachmentArg>;

/**
 * Create an upload URL for one new forum post attachment.
 */
export const generateUploadUrl = mutation({
  args: {
    forumId: vv.id("schoolClassForums"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    await loadOpenForumWithAccess(ctx, args.forumId, user.appUser._id);

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Validate forum mentions and return a deduplicated list.
 */
async function validateForumMentions(
  ctx: MutationCtx,
  {
    forum,
    mentionedUserIds,
  }: {
    forum: Awaited<ReturnType<typeof loadForumWithAccess>>["forum"];
    mentionedUserIds: Id<"users">[];
  }
) {
  if (mentionedUserIds.length === 0) {
    return [];
  }

  const uniqueMentionedUserIds = [...new Set(mentionedUserIds)];

  if (uniqueMentionedUserIds.length > MAX_FORUM_POST_MENTIONS) {
    throw new ConvexError({
      code: "FORUM_MENTION_LIMIT_EXCEEDED",
      message: "Forum post mention count exceeds the supported limit.",
    });
  }

  const accessChecks = await Promise.all(
    uniqueMentionedUserIds.map(async (mentionedUserId) => {
      const classMember = await ctx.db
        .query("schoolClassMembers")
        .withIndex("classId_userId", (q) =>
          q.eq("classId", forum.classId).eq("userId", mentionedUserId)
        )
        .first();

      if (classMember) {
        return true;
      }

      const schoolMember = await ctx.db
        .query("schoolMembers")
        .withIndex("by_schoolId_and_userId_and_status", (q) =>
          q
            .eq("schoolId", forum.schoolId)
            .eq("userId", mentionedUserId)
            .eq("status", "active")
        )
        .first();

      return isAdmin(schoolMember);
    })
  );

  if (accessChecks.every(Boolean)) {
    return uniqueMentionedUserIds;
  }

  throw new ConvexError({
    code: "INVALID_FORUM_MENTION",
    message: "Mentions must target users who can access this forum.",
  });
}

/**
 * Create a new forum post.
 */
export const createForumPost = mutation({
  args: {
    attachments: v.optional(v.array(attachmentArg)),
    body: v.string(),
    forumId: vv.id("schoolClassForums"),
    mentions: v.optional(v.array(vv.id("users"))),
    parentId: v.optional(vv.id("schoolClassForumPosts")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const userId = user.appUser._id;
    const attachments = args.attachments ?? [];

    if (attachments.length > MAX_FORUM_POST_ATTACHMENTS) {
      throw new ConvexError({
        code: "FORUM_ATTACHMENT_LIMIT_EXCEEDED",
        message: "Forum post attachment count exceeds the supported limit.",
      });
    }

    if (!(args.body.trim().length > 0 || attachments.length > 0)) {
      throw new ConvexError({
        code: "EMPTY_POST",
        message: "Post must have either a message or attachments.",
      });
    }

    const { forum } = await loadOpenForumWithAccess(ctx, args.forumId, userId);
    const mentions = await validateForumMentions(ctx, {
      forum,
      mentionedUserIds: args.mentions ?? [],
    });

    let replyToBody: string | undefined;
    let replyToUserId: Id<"users"> | undefined;

    if (args.parentId) {
      const parentPost = await ctx.db.get(
        "schoolClassForumPosts",
        args.parentId
      );

      if (!parentPost || parentPost.forumId !== args.forumId) {
        throw new ConvexError({
          code: "PARENT_POST_NOT_FOUND",
          message: "Parent post not found.",
        });
      }

      replyToBody = truncateText({ text: parentPost.body });
      replyToUserId = parentPost.createdBy;
    }

    const now = Date.now();
    const postId = await ctx.db.insert("schoolClassForumPosts", {
      body: args.body,
      classId: forum.classId,
      createdBy: userId,
      forumId: args.forumId,
      isDeleted: false,
      mentions,
      parentId: args.parentId,
      reactionCounts: [],
      replyCount: 0,
      replyToBody,
      replyToUserId,
      updatedAt: now,
    });

    for (const attachment of attachments) {
      await ctx.db.insert("schoolClassForumPostAttachments", {
        classId: forum.classId,
        createdBy: userId,
        fileId: attachment.storageId,
        forumId: args.forumId,
        mimeType: attachment.type,
        name: attachment.name,
        postId,
        size: attachment.size,
      });
    }

    return postId;
  },
});

/**
 * Mark a forum as read through a concrete post boundary.
 */
export const markForumRead = mutation({
  args: {
    forumId: vv.id("schoolClassForums"),
    lastReadPostId: vv.id("schoolClassForumPosts"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const userId = user.appUser._id;
    const { forum } = await loadForumWithAccess(ctx, args.forumId, userId);
    const lastReadPost = await ctx.db.get(
      "schoolClassForumPosts",
      args.lastReadPostId
    );

    if (!lastReadPost || lastReadPost.forumId !== args.forumId) {
      throw new ConvexError({
        code: "POST_NOT_FOUND",
        message: "Read boundary post not found.",
      });
    }

    await updateForumReadState(ctx, {
      classId: forum.classId,
      forumId: args.forumId,
      lastReadAt: Math.min(lastReadPost._creationTime, forum.lastPostAt),
      lastReadPostId: lastReadPost._id,
      userId,
    });
  },
});
