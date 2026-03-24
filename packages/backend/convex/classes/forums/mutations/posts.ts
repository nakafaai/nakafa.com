import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { loadOpenForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import { resolveForumAttachmentUploads } from "@repo/backend/convex/classes/forums/utils/attachments";
import { MAX_FORUM_POST_ATTACHMENTS } from "@repo/backend/convex/classes/forums/utils/constants";
import { validateForumMentions } from "@repo/backend/convex/classes/forums/utils/mentions";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { truncateText } from "@repo/backend/convex/utils/helper";
import { ConvexError, v } from "convex/values";

/**
 * Create a new forum post.
 */
export const createForumPost = mutation({
  args: {
    attachmentUploadIds: v.optional(
      v.array(vv.id("schoolClassForumPendingUploads"))
    ),
    body: v.string(),
    forumId: vv.id("schoolClassForums"),
    mentions: v.optional(v.array(vv.id("users"))),
    parentId: v.optional(vv.id("schoolClassForumPosts")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const userId = user.appUser._id;
    const attachmentUploadIds = args.attachmentUploadIds ?? [];

    if (attachmentUploadIds.length > MAX_FORUM_POST_ATTACHMENTS) {
      throw new ConvexError({
        code: "FORUM_ATTACHMENT_LIMIT_EXCEEDED",
        message: "Forum post attachment count exceeds the supported limit.",
      });
    }

    if (!(args.body.trim().length > 0 || attachmentUploadIds.length > 0)) {
      throw new ConvexError({
        code: "EMPTY_POST",
        message: "Post must have either a message or attachments.",
      });
    }

    const { forum } = await loadOpenForumWithAccess(ctx, args.forumId, userId);
    const attachments = await resolveForumAttachmentUploads(ctx, {
      forumId: args.forumId,
      uploadIds: attachmentUploadIds,
      userId,
    });

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
        mimeType: attachment.mimeType,
        name: attachment.name,
        postId,
        size: attachment.size,
      });

      await ctx.db.delete("schoolClassForumPendingUploads", attachment._id);
    }

    return postId;
  },
});
