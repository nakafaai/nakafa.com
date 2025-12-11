import { ConvexError, v } from "convex/values";
import { mutation } from "../functions";
import {
  isSchoolAdmin,
  requireAuth,
  requireClassAccess,
} from "../lib/authHelpers";
import { generateNanoId, truncateText } from "../utils/helper";
import { getRandomClassImage, PERMISSION_SETS } from "./constants";

/**
 * Create a new class in a school and automatically add the creator as a primary teacher.
 */
export const createClass = mutation({
  args: {
    schoolId: v.id("schools"),
    name: v.string(),
    subject: v.string(),
    year: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;

    // Verify school membership and permissions (admin or teacher can create classes)
    const schoolMember = await ctx.db
      .query("schoolMembers")
      .withIndex("schoolId_userId_status", (q) =>
        q
          .eq("schoolId", args.schoolId)
          .eq("userId", userId)
          .eq("status", "active")
      )
      .first();

    if (
      !schoolMember ||
      (schoolMember.role !== "admin" && schoolMember.role !== "teacher")
    ) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have permission to create classes in this school.",
      });
    }

    const now = Date.now();

    const classId = await ctx.db.insert("schoolClasses", {
      schoolId: args.schoolId,
      name: args.name,
      subject: args.subject,
      year: args.year,
      image: getRandomClassImage(now.toString()),
      isArchived: false,
      studentCount: 0,
      teacherCount: 0,
      createdBy: userId,
      updatedBy: userId,
      updatedAt: now,
    });

    // Automatically add creator as primary teacher
    await ctx.db.insert("schoolClassMembers", {
      classId,
      userId,
      schoolId: args.schoolId,
      role: "teacher",
      teacherRole: "primary",
      teacherPermissions: PERMISSION_SETS.PRIMARY,
      updatedAt: now,
      addedBy: userId,
    });

    // Generate invite codes for teacher and student roles
    const roles = ["teacher", "student"] as const;
    for (const role of roles) {
      await ctx.db.insert("schoolClassInviteCodes", {
        classId,
        schoolId: args.schoolId,
        role,
        code: generateNanoId(),
        enabled: true,
        currentUsage: 0,
        createdBy: userId,
        updatedBy: userId,
        updatedAt: now,
      });
    }

    return classId;
  },
});

/**
 * Join a class using an invite code.
 */
export const joinClass = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;

    // Find invite code
    const inviteCode = await ctx.db
      .query("schoolClassInviteCodes")
      .withIndex("code", (q) => q.eq("code", args.code))
      .first();

    if (!inviteCode) {
      throw new ConvexError({
        code: "INVALID_CODE",
        message: "Invalid invite code.",
      });
    }

    // Check if code is enabled
    if (!inviteCode.enabled) {
      throw new ConvexError({
        code: "CODE_DISABLED",
        message: "This invite code has been disabled.",
      });
    }

    // Check expiry
    if (inviteCode.expiresAt && inviteCode.expiresAt < Date.now()) {
      throw new ConvexError({
        code: "CODE_EXPIRED",
        message: "This invite code has expired.",
      });
    }

    // Check usage limit
    if (inviteCode.maxUsage && inviteCode.currentUsage >= inviteCode.maxUsage) {
      throw new ConvexError({
        code: "CODE_LIMIT_REACHED",
        message: "This invite code has reached its usage limit.",
      });
    }

    // Get class
    const classData = await ctx.db.get(inviteCode.classId);
    if (!classData) {
      throw new ConvexError({
        code: "CLASS_NOT_FOUND",
        message: "Class not found.",
      });
    }

    // Check if class is archived
    if (classData.isArchived) {
      throw new ConvexError({
        code: "CLASS_ARCHIVED",
        message: "Cannot join an archived class.",
      });
    }

    const now = Date.now();

    // Check if user is already a member
    const existingMember = await ctx.db
      .query("schoolClassMembers")
      .withIndex("classId_userId", (q) =>
        q.eq("classId", classData._id).eq("userId", userId)
      )
      .first();

    if (existingMember) {
      throw new ConvexError({
        code: "ALREADY_MEMBER",
        message: "You are already a member of this class.",
      });
    }

    // Check if user is a member of the school
    const schoolMember = await ctx.db
      .query("schoolMembers")
      .withIndex("schoolId_userId_status", (q) =>
        q
          .eq("schoolId", classData.schoolId)
          .eq("userId", userId)
          .eq("status", "active")
      )
      .first();

    if (!schoolMember) {
      throw new ConvexError({
        code: "NOT_SCHOOL_MEMBER",
        message: "You must be a member of the school to join this class.",
      });
    }

    // Add user as class member with role from invite code
    if (inviteCode.role === "teacher") {
      await ctx.db.insert("schoolClassMembers", {
        classId: classData._id,
        userId,
        schoolId: classData.schoolId,
        role: "teacher",
        teacherRole: "co-teacher",
        teacherPermissions: PERMISSION_SETS.CO_TEACHER,
        inviteCodeId: inviteCode._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("schoolClassMembers", {
        classId: classData._id,
        userId,
        schoolId: classData.schoolId,
        role: "student",
        enrollMethod: "code",
        inviteCodeId: inviteCode._id,
        updatedAt: now,
      });
    }

    return { classId: classData._id };
  },
});

/**
 * Create a new forum in a class.
 */
export const createForum = mutation({
  args: {
    classId: v.id("schoolClasses"),
    title: v.string(),
    body: v.string(),
    tag: v.union(
      v.literal("general"),
      v.literal("question"),
      v.literal("announcement"),
      v.literal("assignment"),
      v.literal("resource")
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;

    // Get class to verify existence
    const classData = await ctx.db.get(args.classId);
    if (!classData) {
      throw new ConvexError({
        code: "CLASS_NOT_FOUND",
        message: "Class not found.",
      });
    }

    // Check if class is archived
    if (classData.isArchived) {
      throw new ConvexError({
        code: "CLASS_ARCHIVED",
        message: "Cannot create a forum in an archived class.",
      });
    }

    // Require class access and get membership
    const { classMembership, schoolMembership } = await requireClassAccess(
      ctx,
      args.classId,
      classData.schoolId,
      userId
    );

    // School admins can do anything, otherwise must be a class member
    const canCreateForum = isSchoolAdmin(schoolMembership) || classMembership;
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

/**
 * Create a new post in a forum.
 */
export const createForumPost = mutation({
  args: {
    forumId: v.id("schoolClassForums"),
    body: v.string(),
    mentions: v.optional(v.array(v.id("users"))),
    parentId: v.optional(v.id("schoolClassForumPosts")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;

    const forum = await ctx.db.get(args.forumId);
    if (!forum) {
      throw new ConvexError({
        code: "FORUM_NOT_FOUND",
        message: "Forum not found.",
      });
    }

    if (forum.status !== "open") {
      throw new ConvexError({
        code: "FORUM_LOCKED",
        message: "This forum is locked.",
      });
    }

    await requireClassAccess(ctx, forum.classId, forum.schoolId, userId);

    let replyToUserId: typeof args.parentId extends undefined
      ? undefined
      : typeof userId | undefined;
    let replyToBody: string | undefined;

    if (args.parentId) {
      const parentPost = await ctx.db.get(args.parentId);
      if (!parentPost || parentPost.forumId !== args.forumId) {
        throw new ConvexError({
          code: "PARENT_POST_NOT_FOUND",
          message: "Parent post not found.",
        });
      }
      replyToUserId = parentPost.createdBy;
      // Store preview snippet (truncated, like Discord)
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

    return postId;
  },
});

/**
 * Toggle a reaction on a post (Discord-style).
 * If the user already reacted with this emoji, remove it.
 * If not, add it.
 *
 * Note: Denormalized reaction counts are updated via trigger in functions.ts
 */
export const togglePostReaction = mutation({
  args: {
    postId: v.id("schoolClassForumPosts"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;

    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new ConvexError({
        code: "POST_NOT_FOUND",
        message: "Post not found.",
      });
    }

    const forum = await ctx.db.get(post.forumId);
    if (!forum) {
      throw new ConvexError({
        code: "FORUM_NOT_FOUND",
        message: "Forum not found.",
      });
    }

    await requireClassAccess(ctx, post.classId, forum.schoolId, userId);

    // Check if user already reacted with this emoji
    const existingReaction = await ctx.db
      .query("schoolClassForumPostReactions")
      .withIndex("postId_userId_emoji", (q) =>
        q.eq("postId", args.postId).eq("userId", userId).eq("emoji", args.emoji)
      )
      .unique();

    if (existingReaction) {
      // Remove reaction - trigger handles count update
      await ctx.db.delete(existingReaction._id);
      return { added: false };
    }

    // Add reaction - trigger handles count update
    await ctx.db.insert("schoolClassForumPostReactions", {
      postId: args.postId,
      userId,
      emoji: args.emoji,
    });

    return { added: true };
  },
});

/**
 * Toggle a reaction on a forum thread.
 * If the user already reacted with this emoji, remove it.
 * If not, add it.
 *
 * Note: Denormalized reaction counts are updated via trigger in functions.ts
 */
export const toggleForumReaction = mutation({
  args: {
    forumId: v.id("schoolClassForums"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;

    const forum = await ctx.db.get(args.forumId);
    if (!forum) {
      throw new ConvexError({
        code: "FORUM_NOT_FOUND",
        message: "Forum not found.",
      });
    }

    await requireClassAccess(ctx, forum.classId, forum.schoolId, userId);

    // Check if user already reacted with this emoji
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
      // Remove reaction - trigger handles count update
      await ctx.db.delete(existingReaction._id);
      return { added: false };
    }

    // Add reaction - trigger handles count update
    await ctx.db.insert("schoolClassForumReactions", {
      forumId: args.forumId,
      userId,
      emoji: args.emoji,
    });

    return { added: true };
  },
});
