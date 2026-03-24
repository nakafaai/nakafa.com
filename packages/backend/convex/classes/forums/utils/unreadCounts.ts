import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  FORUM_UNREAD_COUNT_LIMIT,
  FORUM_UNREAD_SCAN_LIMIT,
} from "@repo/backend/convex/classes/forums/utils/constants";
import { getForumPostsAtTimestamp } from "@repo/backend/convex/classes/forums/utils/timestampPosts";
import { asyncMap } from "convex-helpers";

async function getUnreadForumPostCount(
  ctx: QueryCtx,
  {
    forumId,
    lastReadAt,
    lastReadPostId,
    userId,
  }: {
    forumId: Id<"schoolClassForums">;
    lastReadAt: number;
    lastReadPostId?: Id<"schoolClassForumPosts">;
    userId: Id<"users">;
  }
) {
  const sameTimestampPosts = await getForumPostsAtTimestamp(ctx.db, {
    forumId,
    timestamp: lastReadAt,
  });
  const sameTimestampUnreadPosts = lastReadPostId
    ? (() => {
        const boundaryIndex = sameTimestampPosts.findIndex(
          (post) => post._id === lastReadPostId
        );

        if (boundaryIndex >= 0) {
          return sameTimestampPosts.slice(boundaryIndex + 1);
        }

        return sameTimestampPosts;
      })()
    : [];

  let unreadCount = 0;

  for (const post of sameTimestampUnreadPosts) {
    if (post.createdBy === userId) {
      continue;
    }

    unreadCount += 1;

    if (unreadCount >= FORUM_UNREAD_COUNT_LIMIT) {
      return FORUM_UNREAD_COUNT_LIMIT;
    }
  }

  const newerPosts = await ctx.db
    .query("schoolClassForumPosts")
    .withIndex("forumId", (q) =>
      q.eq("forumId", forumId).gt("_creationTime", lastReadAt)
    )
    .take(FORUM_UNREAD_SCAN_LIMIT);

  for (const post of newerPosts) {
    if (post.createdBy === userId) {
      continue;
    }

    unreadCount += 1;

    if (unreadCount >= FORUM_UNREAD_COUNT_LIMIT) {
      return FORUM_UNREAD_COUNT_LIMIT;
    }
  }

  return unreadCount;
}

/**
 * Get unread post counts for multiple forums.
 */
export async function getForumUnreadCounts(
  ctx: QueryCtx,
  {
    forums,
    userId,
  }: {
    forums: Array<{
      _id: Id<"schoolClassForums">;
      lastPostAt: number;
    }>;
    userId: Id<"users">;
  }
): Promise<Map<Id<"schoolClassForums">, number>> {
  if (forums.length === 0) {
    return new Map();
  }

  const counts = await asyncMap(forums, async (forum) => {
    const readState = await ctx.db
      .query("schoolClassForumReadStates")
      .withIndex("forumId_userId", (q) =>
        q.eq("forumId", forum._id).eq("userId", userId)
      )
      .unique();
    const lastReadAt = readState?.lastReadAt ?? 0;

    if (forum.lastPostAt < lastReadAt) {
      return { count: 0, forumId: forum._id };
    }

    return {
      count: await getUnreadForumPostCount(ctx, {
        forumId: forum._id,
        lastReadAt,
        lastReadPostId: readState?.lastReadPostId,
        userId,
      }),
      forumId: forum._id,
    };
  });

  return new Map(counts.map((count) => [count.forumId, count.count]));
}
