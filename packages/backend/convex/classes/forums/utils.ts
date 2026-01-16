import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { requireClassAccess } from "@repo/backend/convex/lib/authHelpers";
import { getUserMap } from "@repo/backend/convex/lib/userHelpers";
import { ConvexError } from "convex/values";
import { asyncMap } from "convex-helpers";

/**
 * Batch fetch user data for forum creators.
 * Returns a Map for O(1) lookup by userId.
 */
export function attachForumUsers(
  ctx: QueryCtx,
  forums: Doc<"schoolClassForums">[]
) {
  return getUserMap(
    ctx,
    forums.map((f) => f.createdBy)
  );
}

/**
 * Get last read timestamp for a forum.
 * Returns null if user has never read the forum.
 */
export async function getForumLastReadAt(
  ctx: QueryCtx,
  forumId: Id<"schoolClassForums">,
  userId: Id<"users">
): Promise<number | null> {
  const readState = await ctx.db
    .query("schoolClassForumReadStates")
    .withIndex("forumId_userId", (q) =>
      q.eq("forumId", forumId).eq("userId", userId)
    )
    .unique();

  return readState?.lastReadAt ?? null;
}

/**
 * Get unread post counts for multiple forums.
 * Returns Map of forumId -> count (capped at 26 for "25+" display).
 * Uses index range query for efficient counting.
 */
export async function getForumUnreadCounts(
  ctx: QueryCtx,
  classId: Id<"schoolClasses">,
  userId: Id<"users">,
  forums: Array<{ _id: Id<"schoolClassForums">; lastPostAt: number }>
): Promise<Map<Id<"schoolClassForums">, number>> {
  const MAX_COUNT = 26;

  const readStates = await ctx.db
    .query("schoolClassForumReadStates")
    .withIndex("classId_userId", (q) =>
      q.eq("classId", classId).eq("userId", userId)
    )
    .collect();
  const readStateMap = new Map(
    readStates.map((rs) => [rs.forumId, rs.lastReadAt])
  );

  const counts = await asyncMap(forums, async (forum) => {
    const lastReadAt = readStateMap.get(forum._id) ?? 0;

    if (forum.lastPostAt <= lastReadAt) {
      return { forumId: forum._id, count: 0 };
    }

    const posts = await ctx.db
      .query("schoolClassForumPosts")
      .withIndex("forumId", (q) =>
        q.eq("forumId", forum._id).gt("_creationTime", lastReadAt)
      )
      .take(MAX_COUNT);

    return { forumId: forum._id, count: posts.length };
  });

  return new Map(counts.map((c) => [c.forumId, c.count]));
}

/**
 * Get current user's emoji reactions for multiple forums.
 * Returns Map of forumId -> emoji array.
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
 * Get current user's emoji reactions for multiple posts.
 * Returns Map of postId -> emoji array.
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

interface ReactionDoc {
  userId: Id<"users">;
  emoji: string;
}

/**
 * Group reactor names by emoji for display.
 * Limits to 10 names per emoji.
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

/**
 * Load a forum by ID.
 * @throws FORUM_NOT_FOUND if forum doesn't exist.
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
 * Load a forum and validate it's open (not locked/archived).
 * @throws FORUM_NOT_FOUND or FORUM_LOCKED.
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
 * Returns forum with membership info.
 * @throws FORUM_NOT_FOUND or ACCESS_DENIED.
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
 * Returns forum with membership info.
 * @throws FORUM_NOT_FOUND, FORUM_LOCKED, or ACCESS_DENIED.
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

export interface PostAttachment {
  _id: Id<"schoolClassForumPostAttachments">;
  name: string;
  url: string | null;
  mimeType: string;
  size: number;
}

/**
 * Enrich posts with user data, reactions, and attachments.
 * Fetches all related data in parallel for performance.
 * Used by getForumPosts and related queries.
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
  const postUserIds = posts.flatMap((p) =>
    p.replyToUserId ? [p.createdBy, p.replyToUserId] : [p.createdBy]
  );

  const [allReactions, myReactionsMap, allAttachments] = await Promise.all([
    asyncMap(postIds, (postId) =>
      ctx.db
        .query("schoolClassForumPostReactions")
        .withIndex("postId_userId_emoji", (idx) => idx.eq("postId", postId))
        .collect()
    ),
    getMyPostReactions(ctx, postIds, currentUserId),
    asyncMap(postIds, (postId) =>
      ctx.db
        .query("schoolClassForumPostAttachments")
        .withIndex("postId", (idx) => idx.eq("postId", postId))
        .collect()
    ),
  ]);

  const reactorUserIds = allReactions.flat().map((r) => r.userId);
  const flatAttachments = allAttachments.flat();

  const [userMap, urls] = await Promise.all([
    getUserMap(ctx, [...postUserIds, ...reactorUserIds]),
    asyncMap(flatAttachments, (att) => ctx.storage.getUrl(att.fileId)),
  ]);

  const reactorMaps = new Map(
    postIds.map((postId, i) => [
      postId,
      buildReactorsByEmoji(allReactions[i], userMap),
    ])
  );

  const urlMap = new Map(flatAttachments.map((att, i) => [att._id, urls[i]]));

  const attachmentsByPost = new Map(
    postIds.map((postId, idx) => [
      postId,
      allAttachments[idx].map((att) => ({
        _id: att._id,
        name: att.name,
        url: urlMap.get(att._id) ?? null,
        mimeType: att.mimeType,
        size: att.size,
      })),
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
    attachments: attachmentsByPost.get(post._id) ?? [],
  }));
}
