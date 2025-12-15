import { ConvexError, v } from "convex/values";
import { mutation } from "../functions";
import { isSchoolAdmin, requireAuth } from "../lib/authHelpers";
import { generateNanoId, truncateText } from "../utils/helper";
import {
  CLASS_IMAGES,
  getRandomClassImage,
  PERMISSION_SETS,
  TEACHER_PERMISSIONS,
} from "./constants";
import {
  loadActiveClass,
  loadActiveClassWithAccess,
  loadClassWithAccess,
  loadForumWithAccess,
  loadOpenForumWithAccess,
  requireTeacherPermission,
} from "./utils";

/**
 * Create a new class in a school and automatically add the creator as a primary teacher.
 */
export const createClass = mutation({
  args: {
    schoolId: v.id("schools"),
    name: v.string(),
    subject: v.string(),
    year: v.string(),
    visibility: v.union(v.literal("private"), v.literal("public")),
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
      visibility: args.visibility,
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

    // Load class and verify it's not archived
    const classData = await loadActiveClass(ctx, inviteCode.classId);

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
 * Update the class visibility.
 * Requires CLASS_MANAGE permission or school admin role.
 * Note: Can update visibility even for archived classes.
 */
export const updateClassVisibility = mutation({
  args: {
    classId: v.id("schoolClasses"),
    visibility: v.union(v.literal("private"), v.literal("public")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;

    // Load class and verify access (allows archived classes)
    const { classMembership, schoolMembership } = await loadClassWithAccess(
      ctx,
      args.classId,
      userId
    );

    requireTeacherPermission(
      classMembership,
      schoolMembership,
      TEACHER_PERMISSIONS.CLASS_MANAGE
    );

    // Update class visibility
    await ctx.db.patch("schoolClasses", args.classId, {
      visibility: args.visibility,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Join a public class directly.
 * Only works for classes with visibility: "public".
 * User must be a school member but not already a class member.
 */
export const joinPublicClass = mutation({
  args: {
    classId: v.id("schoolClasses"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;

    // Load class and verify it's not archived
    const classData = await loadActiveClass(ctx, args.classId);

    // Verify class is public
    if (classData.visibility !== "public") {
      throw new ConvexError({
        code: "CLASS_NOT_PUBLIC",
        message: "This class is not public. Please use an invite code to join.",
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

    // Add user as student (public join always joins as student)
    await ctx.db.insert("schoolClassMembers", {
      classId: classData._id,
      userId,
      schoolId: classData.schoolId,
      role: "student",
      enrollMethod: "public",
      updatedAt: now,
    });

    return { classId: classData._id };
  },
});

/**
 * Update the class image.
 * Requires CLASS_MANAGE permission or school admin role.
 * Note: Can update image even for archived classes.
 */
export const updateClassImage = mutation({
  args: {
    classId: v.id("schoolClasses"),
    image: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;

    // Load class and verify access (allows archived classes to update image)
    const { classMembership, schoolMembership } = await loadClassWithAccess(
      ctx,
      args.classId,
      userId
    );

    requireTeacherPermission(
      classMembership,
      schoolMembership,
      TEACHER_PERMISSIONS.CLASS_MANAGE
    );

    // Validate image is from allowed set
    const validImages = new Set(CLASS_IMAGES.values());
    if (
      !validImages.has(
        args.image as typeof validImages extends Set<infer T> ? T : never
      )
    ) {
      throw new ConvexError({
        code: "INVALID_IMAGE",
        message: "Invalid class image. Please select a valid image.",
      });
    }

    // Update class image
    await ctx.db.patch("schoolClasses", args.classId, {
      image: args.image,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
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

    // Load active class and verify access
    const { classData, classMembership, schoolMembership } =
      await loadActiveClassWithAccess(ctx, args.classId, userId);

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

    // Load open forum and verify access
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

    // Note: Read state is updated via trigger in functions.ts
    // to keep all post-creation side effects in one place

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

    const post = await ctx.db.get("schoolClassForumPosts", args.postId);
    if (!post) {
      throw new ConvexError({
        code: "POST_NOT_FOUND",
        message: "Post not found.",
      });
    }

    // Load forum and verify access (uses post.forumId)
    await loadForumWithAccess(ctx, post.forumId, userId);

    // Check if user already reacted with this emoji
    const existingReaction = await ctx.db
      .query("schoolClassForumPostReactions")
      .withIndex("postId_userId_emoji", (q) =>
        q.eq("postId", args.postId).eq("userId", userId).eq("emoji", args.emoji)
      )
      .unique();

    if (existingReaction) {
      // Remove reaction - trigger handles count update
      await ctx.db.delete(
        "schoolClassForumPostReactions",
        existingReaction._id
      );
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

    await loadForumWithAccess(ctx, args.forumId, userId);

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
      await ctx.db.delete("schoolClassForumReactions", existingReaction._id);
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

/**
 * Mark a forum as read up to current time.
 * Called when user opens/views a forum.
 * Uses upsert pattern for efficiency.
 */
export const markForumRead = mutation({
  args: {
    forumId: v.id("schoolClassForums"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;

    const { forum } = await loadForumWithAccess(ctx, args.forumId, userId);

    const now = Date.now();

    // Upsert pattern with high water mark: only update if moving forward
    const existing = await ctx.db
      .query("schoolClassForumReadStates")
      .withIndex("forumId_userId", (q) =>
        q.eq("forumId", args.forumId).eq("userId", userId)
      )
      .unique();

    if (existing) {
      // High water mark: only update if moving forward in time
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
