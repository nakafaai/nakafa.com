import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { requireClassAccess } from "@repo/backend/convex/lib/helpers/class";
import { getUserMap } from "@repo/backend/convex/lib/helpers/user";
import { ConvexError } from "convex/values";
import { asyncMap } from "convex-helpers";

const FORUM_REACTION_PREVIEW_LIMIT = 10;
const FORUM_REACTION_PREVIEW_BATCH_LIMIT = 20;
const FORUM_ATTACHMENT_LIMIT = 10;
const FORUM_UNREAD_COUNT_LIMIT = 26;

/**
 * Counts unread posts after a read-state boundary, including same-timestamp posts.
 */
async function getUnreadForumPostCount(
  ctx: QueryCtx,
  {
    forumId,
    lastReadAt,
    lastReadPostId,
  }: {
    forumId: Id<"schoolClassForums">;
    lastReadAt: number;
    lastReadPostId?: Id<"schoolClassForumPosts">;
  }
) {
  const sameTimestampPosts = await ctx.db
    .query("schoolClassForumPosts")
    .withIndex("forumId", (q) =>
      q.eq("forumId", forumId).eq("_creationTime", lastReadAt)
    )
    .order("asc")
    .take(FORUM_UNREAD_COUNT_LIMIT + 1);

  let unreadCount = 0;

  if (lastReadPostId) {
    const boundaryIndex = sameTimestampPosts.findIndex(
      (post) => post._id === lastReadPostId
    );

    if (boundaryIndex >= 0) {
      unreadCount += sameTimestampPosts.length - boundaryIndex - 1;
    } else {
      unreadCount += sameTimestampPosts.length;
    }
  }

  if (unreadCount >= FORUM_UNREAD_COUNT_LIMIT) {
    return FORUM_UNREAD_COUNT_LIMIT;
  }

  const newerPosts = await ctx.db
    .query("schoolClassForumPosts")
    .withIndex("forumId", (q) =>
      q.eq("forumId", forumId).gt("_creationTime", lastReadAt)
    )
    .take(FORUM_UNREAD_COUNT_LIMIT - unreadCount);

  return unreadCount + newerPosts.length;
}

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
 * Get the current user's read boundary for one forum.
 */
export async function getForumReadState(
  ctx: QueryCtx,
  forumId: Id<"schoolClassForums">,
  userId: Id<"users">
): Promise<{
  lastReadAt: number | null;
  lastReadPostId: Id<"schoolClassForumPosts"> | null;
}> {
  const readState = await ctx.db
    .query("schoolClassForumReadStates")
    .withIndex("forumId_userId", (q) =>
      q.eq("forumId", forumId).eq("userId", userId)
    )
    .unique();

  return {
    lastReadAt: readState?.lastReadAt ?? null,
    lastReadPostId: readState?.lastReadPostId ?? null,
  };
}

/**
 * Get unread post counts for multiple forums.
 * Returns Map of forumId -> count (capped at 26 for "25+" display).
 * Uses index range query for efficient counting.
 */
export async function getForumUnreadCounts(
  ctx: QueryCtx,
  userId: Id<"users">,
  forums: Array<{ _id: Id<"schoolClassForums">; lastPostAt: number }>
): Promise<Map<Id<"schoolClassForums">, number>> {
  const counts = await asyncMap(forums, async (forum) => {
    const readState = await ctx.db
      .query("schoolClassForumReadStates")
      .withIndex("forumId_userId", (q) =>
        q.eq("forumId", forum._id).eq("userId", userId)
      )
      .unique();
    const lastReadAt = readState?.lastReadAt ?? 0;

    if (forum.lastPostAt <= lastReadAt) {
      return { forumId: forum._id, count: 0 };
    }

    return {
      forumId: forum._id,
      count: await getUnreadForumPostCount(ctx, {
        forumId: forum._id,
        lastReadAt,
        lastReadPostId: readState?.lastReadPostId,
      }),
    };
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
      .take(FORUM_REACTION_PREVIEW_BATCH_LIMIT)
  );

  return new Map(
    forumIds.map((forumId, i) => [forumId, reactions[i].map((r) => r.emoji)])
  );
}

/**
 * Get current user's emoji reactions for multiple posts.
 * Returns Map of postId -> emoji array.
 */
async function getMyPostReactions(
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
      .take(FORUM_REACTION_PREVIEW_BATCH_LIMIT)
  );

  return new Map(
    postIds.map((postId, i) => [postId, reactions[i].map((r) => r.emoji)])
  );
}

/**
 * Gets per-emoji reactor name previews for a single forum.
 * Previews are bounded and follow the forum's aggregated reaction counts.
 */
export async function getForumReactionPreviews(
  ctx: QueryCtx,
  forum: Doc<"schoolClassForums">
) {
  const reactionsByEmoji = await asyncMap(
    forum.reactionCounts,
    ({ count, emoji }) => {
      if (count === 0) {
        return Promise.resolve([]);
      }

      return ctx.db
        .query("schoolClassForumReactions")
        .withIndex("by_forumId_and_emoji_and_userId", (q) =>
          q.eq("forumId", forum._id).eq("emoji", emoji)
        )
        .take(Math.min(count, FORUM_REACTION_PREVIEW_LIMIT));
    }
  );

  const userMap = await getUserMap(
    ctx,
    reactionsByEmoji.flat().map((reaction) => reaction.userId)
  );

  return new Map(
    forum.reactionCounts.map(({ emoji }, index) => [
      emoji,
      reactionsByEmoji[index].map(
        (reaction) => userMap.get(reaction.userId)?.name ?? "Unknown"
      ),
    ])
  );
}

/**
 * Gets per-emoji reactor name previews for a batch of forum posts.
 */
async function getPostReactionPreviews(
  ctx: QueryCtx,
  posts: Doc<"schoolClassForumPosts">[]
) {
  const reactionsByPost = await asyncMap(posts, (post) =>
    asyncMap(post.reactionCounts, ({ count, emoji }) => {
      if (count === 0) {
        return Promise.resolve([]);
      }

      return ctx.db
        .query("schoolClassForumPostReactions")
        .withIndex("by_postId_and_emoji_and_userId", (q) =>
          q.eq("postId", post._id).eq("emoji", emoji)
        )
        .take(Math.min(count, FORUM_REACTION_PREVIEW_LIMIT));
    })
  );

  const userMap = await getUserMap(
    ctx,
    reactionsByPost
      .flat()
      .flat()
      .map((reaction) => reaction.userId)
  );

  return new Map(
    posts.map((post, postIndex) => [
      post._id,
      new Map(
        post.reactionCounts.map(({ emoji }, reactionIndex) => [
          emoji,
          reactionsByPost[postIndex][reactionIndex].map(
            (reaction) => userMap.get(reaction.userId)?.name ?? "Unknown"
          ),
        ])
      ),
    ])
  );
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
async function loadOpenForum(
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
  mimeType: string;
  name: string;
  size: number;
  url: string | null;
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

  const [reactionPreviews, myReactionsMap, allAttachments] = await Promise.all([
    getPostReactionPreviews(ctx, posts),
    getMyPostReactions(ctx, postIds, currentUserId),
    asyncMap(postIds, (postId) =>
      ctx.db
        .query("schoolClassForumPostAttachments")
        .withIndex("postId", (idx) => idx.eq("postId", postId))
        .take(FORUM_ATTACHMENT_LIMIT + 1)
    ),
  ]);

  for (const attachments of allAttachments) {
    if (attachments.length <= FORUM_ATTACHMENT_LIMIT) {
      continue;
    }

    throw new ConvexError({
      code: "FORUM_ATTACHMENT_LIMIT_EXCEEDED",
      message: "Forum post attachment count exceeds the supported limit.",
    });
  }

  const flatAttachments = allAttachments.flat();

  const [userMap, urls] = await Promise.all([
    getUserMap(ctx, postUserIds),
    asyncMap(flatAttachments, (att) => ctx.storage.getUrl(att.fileId)),
  ]);

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
      reactors: reactionPreviews.get(post._id)?.get(emoji) ?? [],
    })),
    attachments: attachmentsByPost.get(post._id) ?? [],
  }));
}
