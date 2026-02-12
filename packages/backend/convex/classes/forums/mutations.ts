import {
  loadForumWithAccess,
  loadOpenForumWithAccess,
} from "@repo/backend/convex/classes/forums/utils";
import { schoolClassForumTagValidator } from "@repo/backend/convex/classes/schema";
import { loadActiveClass } from "@repo/backend/convex/classes/utils";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import { requireClassAccess } from "@repo/backend/convex/lib/helpers/class";
import { isAdmin } from "@repo/backend/convex/lib/helpers/school";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { truncateText } from "@repo/backend/convex/utils/helper";
import { ConvexError, type Infer, v } from "convex/values";

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

export const createForum = mutation({
  args: {
    classId: vv.id("schoolClasses"),
    title: v.string(),
    body: v.string(),
    tag: schoolClassForumTagValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const userId = user.appUser._id;

    const classData = await loadActiveClass(ctx, args.classId);
    const { classMembership, schoolMembership } = await requireClassAccess(
      ctx,
      args.classId,
      classData.schoolId,
      userId
    );

    const canCreateForum = isAdmin(schoolMembership) || classMembership;
    if (!canCreateForum) {
      throw new ConvexError({
        code: "NOT_CLASS_MEMBER",
        message: "You must be a member of the class to create a forum.",
      });
    }

    const now = Date.now();

    const forumId = await ctx.db.insert("schoolClassForums", {
      classId: args.classId,
      schoolId: classData.schoolId,
      title: args.title,
      body: args.body,
      tag: args.tag,
      status: "open",
      isPinned: false,
      postCount: 0,
      participantCount: 1,
      reactionCounts: [],
      lastPostAt: now,
      lastPostBy: userId,
      createdBy: userId,
      updatedAt: now,
    });

    return forumId;
  },
});

const attachmentArg = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  type: v.string(),
  size: v.number(),
});
export type AttachmentArg = Infer<typeof attachmentArg>;

export const createForumPost = mutation({
  args: {
    forumId: vv.id("schoolClassForums"),
    body: v.string(),
    mentions: v.optional(v.array(vv.id("users"))),
    parentId: v.optional(vv.id("schoolClassForumPosts")),
    attachments: v.optional(v.array(attachmentArg)),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const userId = user.appUser._id;

    const hasBody = args.body.trim().length > 0;
    const attachments = args.attachments ?? [];
    const hasAttachments = attachments.length > 0;

    if (!(hasBody || hasAttachments)) {
      throw new ConvexError({
        code: "EMPTY_POST",
        message: "Post must have either a message or attachments.",
      });
    }

    const { forum } = await loadOpenForumWithAccess(ctx, args.forumId, userId);

    let replyToUserId: typeof args.parentId extends undefined
      ? undefined
      : typeof userId | undefined;
    let replyToBody: string | undefined;

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
      replyToUserId = parentPost.createdBy;
      replyToBody = truncateText({ text: parentPost.body });
    }

    const now = Date.now();

    const postId = await ctx.db.insert("schoolClassForumPosts", {
      forumId: args.forumId,
      classId: forum.classId,
      body: args.body,
      mentions: args.mentions ?? [],
      parentId: args.parentId,
      replyToUserId,
      replyToBody,
      replyCount: 0,
      reactionCounts: [],
      isDeleted: false,
      createdBy: userId,
      updatedAt: now,
    });

    for (const attachment of attachments) {
      await ctx.db.insert("schoolClassForumPostAttachments", {
        postId,
        forumId: args.forumId,
        classId: forum.classId,
        name: attachment.name,
        fileId: attachment.storageId,
        mimeType: attachment.type,
        size: attachment.size,
        createdBy: userId,
      });
    }

    return postId;
  },
});

export const togglePostReaction = mutation({
  args: {
    postId: vv.id("schoolClassForumPosts"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const userId = user.appUser._id;

    const post = await ctx.db.get("schoolClassForumPosts", args.postId);
    if (!post) {
      throw new ConvexError({
        code: "POST_NOT_FOUND",
        message: "Post not found.",
      });
    }

    await loadForumWithAccess(ctx, post.forumId, userId);

    const existingReaction = await ctx.db
      .query("schoolClassForumPostReactions")
      .withIndex("postId_userId_emoji", (q) =>
        q.eq("postId", args.postId).eq("userId", userId).eq("emoji", args.emoji)
      )
      .unique();

    if (existingReaction) {
      await ctx.db.delete(
        "schoolClassForumPostReactions",
        existingReaction._id
      );
      return { added: false };
    }

    await ctx.db.insert("schoolClassForumPostReactions", {
      postId: args.postId,
      userId,
      emoji: args.emoji,
    });

    return { added: true };
  },
});

export const toggleForumReaction = mutation({
  args: {
    forumId: vv.id("schoolClassForums"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const userId = user.appUser._id;

    await loadForumWithAccess(ctx, args.forumId, userId);

    const existingReaction = await ctx.db
      .query("schoolClassForumReactions")
      .withIndex("forumId_userId_emoji", (q) =>
        q
          .eq("forumId", args.forumId)
          .eq("userId", userId)
          .eq("emoji", args.emoji)
      )
      .unique();

    if (existingReaction) {
      await ctx.db.delete("schoolClassForumReactions", existingReaction._id);
      return { added: false };
    }

    await ctx.db.insert("schoolClassForumReactions", {
      forumId: args.forumId,
      userId,
      emoji: args.emoji,
    });

    return { added: true };
  },
});

export const markForumRead = mutation({
  args: {
    forumId: vv.id("schoolClassForums"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const userId = user.appUser._id;

    const { forum } = await loadForumWithAccess(ctx, args.forumId, userId);

    const now = Date.now();

    const existing = await ctx.db
      .query("schoolClassForumReadStates")
      .withIndex("forumId_userId", (q) =>
        q.eq("forumId", args.forumId).eq("userId", userId)
      )
      .unique();

    if (existing) {
      if (now > existing.lastReadAt) {
        await ctx.db.patch("schoolClassForumReadStates", existing._id, {
          lastReadAt: now,
        });
      }
    } else {
      await ctx.db.insert("schoolClassForumReadStates", {
        forumId: args.forumId,
        classId: forum.classId,
        userId,
        lastReadAt: now,
      });
    }
  },
});
