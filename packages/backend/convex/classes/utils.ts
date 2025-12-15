import { ConvexError } from "convex/values";
import { asyncMap } from "convex-helpers";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isSchoolAdmin, requireClassAccess } from "../lib/authHelpers";
import { getUserMap } from "../lib/userHelpers";
import type { TeacherPermission } from "./constants";

// ============================================================================
// User Helpers
// ============================================================================

export function attachForumUsers(
  ctx: QueryCtx,
  forums: Doc<"schoolClassForums">[]
) {
  return getUserMap(
    ctx,
    forums.map((f) => f.createdBy)
  );
}

// ============================================================================
// Reaction Helpers
// ============================================================================

/**
 * Get current user's reactions for multiple forums.
 * Returns a Map of forumId -> emoji array.
 * Uses parallel queries with index for efficient fetching.
 */
export async function getMyForumReactions(
  ctx: QueryCtx,
  forumIds: Id<"schoolClassForums">[],
  userId: Id<"users">
): Promise<Map<Id<"schoolClassForums">, string[]>> {
  const reactions = await asyncMap(forumIds, (forumId) =>
    ctx.db
      .query("schoolClassForumReactions")
      .withIndex("forumId_userId_emoji", (q) =>
        q.eq("forumId", forumId).eq("userId", userId)
      )
      .collect()
  );

  return new Map(
    forumIds.map((forumId, i) => [forumId, reactions[i].map((r) => r.emoji)])
  );
}

/**
 * Get current user's reactions for multiple posts.
 * Returns a Map of postId -> emoji array.
 */
export async function getMyPostReactions(
  ctx: QueryCtx,
  postIds: Id<"schoolClassForumPosts">[],
  userId: Id<"users">
): Promise<Map<Id<"schoolClassForumPosts">, string[]>> {
  const reactions = await asyncMap(postIds, (postId) =>
    ctx.db
      .query("schoolClassForumPostReactions")
      .withIndex("postId_userId_emoji", (q) =>
        q.eq("postId", postId).eq("userId", userId)
      )
      .collect()
  );

  return new Map(
    postIds.map((postId, i) => [postId, reactions[i].map((r) => r.emoji)])
  );
}

type ReactionDoc = { userId: Id<"users">; emoji: string };

/**
 * Build reactor names by emoji from reactions.
 * Limits to 10 names per emoji for display.
 */
export function buildReactorsByEmoji(
  reactions: ReactionDoc[],
  userMap: Map<Id<"users">, { name: string }>
): Map<string, string[]> {
  const reactorsByEmoji = new Map<string, string[]>();

  for (const reaction of reactions) {
    const userName = userMap.get(reaction.userId)?.name ?? "Unknown";
    const existing = reactorsByEmoji.get(reaction.emoji) ?? [];
    if (existing.length < 10) {
      existing.push(userName);
    }
    reactorsByEmoji.set(reaction.emoji, existing);
  }

  return reactorsByEmoji;
}

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Check if a teacher has a specific permission.
 * School admins automatically have all permissions.
 */
export function hasTeacherPermission(
  classMembership: Doc<"schoolClassMembers"> | null,
  schoolMembership: Doc<"schoolMembers"> | null,
  permission: TeacherPermission
): boolean {
  // School admins have all permissions
  if (isSchoolAdmin(schoolMembership)) {
    return true;
  }

  // Check if user is a teacher with the required permission
  if (
    classMembership?.role === "teacher" &&
    classMembership.teacherPermissions?.includes(permission)
  ) {
    return true;
  }

  return false;
}

/**
 * Require a specific teacher permission.
 * Throws FORBIDDEN error if user doesn't have the permission.
 */
export function requireTeacherPermission(
  classMembership: Doc<"schoolClassMembers"> | null,
  schoolMembership: Doc<"schoolMembers"> | null,
  permission: TeacherPermission
): void {
  if (!hasTeacherPermission(classMembership, schoolMembership, permission)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action.",
    });
  }
}

// ============================================================================
// Class Loading Helpers
// ============================================================================

/**
 * Load a class by ID.
 * Throws CLASS_NOT_FOUND error if class doesn't exist.
 */
export async function loadClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"schoolClasses">
) {
  const classData = await ctx.db.get("schoolClasses", classId);

  if (!classData) {
    throw new ConvexError({
      code: "CLASS_NOT_FOUND",
      message: "Class not found.",
    });
  }

  return classData;
}

/**
 * Load a class and validate it's not archived.
 * Throws CLASS_NOT_FOUND or CLASS_ARCHIVED error.
 */
export async function loadActiveClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"schoolClasses">
) {
  const classData = await loadClass(ctx, classId);

  if (classData.isArchived) {
    throw new ConvexError({
      code: "CLASS_ARCHIVED",
      message: "Cannot modify an archived class.",
    });
  }

  return classData;
}

/**
 * Load class and verify user has access.
 * Combines loadClass + requireClassAccess for cleaner code.
 */
export async function loadClassWithAccess(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"schoolClasses">,
  userId: Id<"users">
) {
  const classData = await loadClass(ctx, classId);
  const access = await requireClassAccess(
    ctx,
    classId,
    classData.schoolId,
    userId
  );
  return { classData, ...access };
}

/**
 * Load active class (not archived) and verify user has access.
 * Combines loadActiveClass + requireClassAccess for cleaner code.
 */
export async function loadActiveClassWithAccess(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"schoolClasses">,
  userId: Id<"users">
) {
  const classData = await loadActiveClass(ctx, classId);
  const access = await requireClassAccess(
    ctx,
    classId,
    classData.schoolId,
    userId
  );
  return { classData, ...access };
}

// ============================================================================
// Forum Loading Helpers
// ============================================================================

/**
 * Load a forum by ID.
 * Throws FORUM_NOT_FOUND error if forum doesn't exist.
 */
export async function loadForum(
  ctx: QueryCtx | MutationCtx,
  forumId: Id<"schoolClassForums">
) {
  const forum = await ctx.db.get("schoolClassForums", forumId);

  if (!forum) {
    throw new ConvexError({
      code: "FORUM_NOT_FOUND",
      message: "Forum not found.",
    });
  }

  return forum;
}

/**
 * Load a forum and validate it's open.
 * Throws FORUM_NOT_FOUND or FORUM_LOCKED error.
 */
export async function loadOpenForum(
  ctx: QueryCtx | MutationCtx,
  forumId: Id<"schoolClassForums">
) {
  const forum = await loadForum(ctx, forumId);

  if (forum.status !== "open") {
    throw new ConvexError({
      code: "FORUM_LOCKED",
      message: "This forum is locked.",
    });
  }

  return forum;
}

/**
 * Load forum and verify user has access to its class.
 * Combines loadForum + requireClassAccess for cleaner code.
 */
export async function loadForumWithAccess(
  ctx: QueryCtx | MutationCtx,
  forumId: Id<"schoolClassForums">,
  userId: Id<"users">
) {
  const forum = await loadForum(ctx, forumId);
  const access = await requireClassAccess(
    ctx,
    forum.classId,
    forum.schoolId,
    userId
  );
  return { forum, ...access };
}

/**
 * Load open forum and verify user has access to its class.
 * Combines loadOpenForum + requireClassAccess for cleaner code.
 */
export async function loadOpenForumWithAccess(
  ctx: QueryCtx | MutationCtx,
  forumId: Id<"schoolClassForums">,
  userId: Id<"users">
) {
  const forum = await loadOpenForum(ctx, forumId);
  const access = await requireClassAccess(
    ctx,
    forum.classId,
    forum.schoolId,
    userId
  );
  return { forum, ...access };
}

// ============================================================================
// Post Enrichment Helper
// ============================================================================

/**
 * Enrich posts with user data and reactions.
 * Used by getForumPosts, getForumPostsAround, getForumPostsOlder, getForumPostsNewer.
 */
export async function enrichForumPosts(
  ctx: QueryCtx,
  posts: Doc<"schoolClassForumPosts">[],
  currentUserId: Id<"users">
) {
  if (posts.length === 0) {
    return [];
  }

  const postIds = posts.map((p) => p._id);

  const [allReactions, myReactionsMap] = await Promise.all([
    asyncMap(postIds, (postId) =>
      ctx.db
        .query("schoolClassForumPostReactions")
        .withIndex("postId_userId_emoji", (idx) => idx.eq("postId", postId))
        .collect()
    ),
    getMyPostReactions(ctx, postIds, currentUserId),
  ]);

  const reactorUserIds = allReactions.flat().map((r) => r.userId);
  const postUserIds = posts.flatMap((p) =>
    p.replyToUserId ? [p.createdBy, p.replyToUserId] : [p.createdBy]
  );
  const userMap = await getUserMap(ctx, [...postUserIds, ...reactorUserIds]);

  const reactorMaps = new Map(
    postIds.map((postId, i) => [
      postId,
      buildReactorsByEmoji(allReactions[i], userMap),
    ])
  );

  return posts.map((post) => ({
    ...post,
    user: userMap.get(post.createdBy) ?? null,
    replyToUser: post.replyToUserId
      ? (userMap.get(post.replyToUserId) ?? null)
      : null,
    myReactions: myReactionsMap.get(post._id) ?? [],
    reactionUsers: post.reactionCounts.map(({ emoji, count }) => ({
      emoji,
      count,
      reactors: reactorMaps.get(post._id)?.get(emoji) ?? [],
    })),
  }));
}
