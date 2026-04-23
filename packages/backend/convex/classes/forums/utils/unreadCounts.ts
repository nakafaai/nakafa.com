import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  forumPostsByAuthorSequence,
  forumPostsBySequence,
} from "@repo/backend/convex/classes/forums/aggregate";
import { asyncMap } from "convex-helpers";

/** Load the current viewer's read-state rows for one forum page. */
async function getForumReadStateMap(
  ctx: QueryCtx,
  {
    forumIds,
    userId,
  }: {
    forumIds: Id<"schoolClassForums">[];
    userId: Id<"users">;
  }
) {
  const readStates = await asyncMap(forumIds, async (forumId) => ({
    forumId,
    readState: await ctx.db
      .query("schoolClassForumReadStates")
      .withIndex("by_forumId_and_userId", (q) =>
        q.eq("forumId", forumId).eq("userId", userId)
      )
      .unique(),
  }));

  return new Map(
    readStates.map(({ forumId, readState }) => [forumId, readState])
  );
}

/**
 * Return exact unread counts for one forum page by combining total post counts
 * with the viewer's own authored posts after the stored read boundary.
 */
export async function getForumUnreadCounts(
  ctx: QueryCtx,
  {
    forums,
    userId,
  }: {
    forums: Pick<
      Doc<"schoolClassForums">,
      "_id" | "nextPostSequence" | "postCount"
    >[];
    userId: Id<"users">;
  }
) {
  if (forums.length === 0) {
    return new Map();
  }

  const readStateByForumId = await getForumReadStateMap(ctx, {
    forumIds: forums.map((forum) => forum._id),
    userId,
  });
  const forumsWithUnreadPotential = forums.filter((forum) => {
    if (forum.postCount === 0) {
      return false;
    }

    const lastReadSequence =
      readStateByForumId.get(forum._id)?.lastReadSequence ?? 0;
    return lastReadSequence < forum.nextPostSequence - 1;
  });

  const unreadCountByForumId = new Map(forums.map((forum) => [forum._id, 0]));

  if (forumsWithUnreadPotential.length === 0) {
    return unreadCountByForumId;
  }

  const totalUnreadCounts = await forumPostsBySequence.countBatch(
    ctx,
    forumsWithUnreadPotential.map((forum) => ({
      bounds: {
        lower: {
          key: readStateByForumId.get(forum._id)?.lastReadSequence ?? 0,
          inclusive: false,
        },
      },
      namespace: forum._id,
    }))
  );
  const ownUnreadCounts = await forumPostsByAuthorSequence.countBatch(
    ctx,
    forumsWithUnreadPotential.map((forum) => ({
      bounds: {
        lower: {
          key: readStateByForumId.get(forum._id)?.lastReadSequence ?? 0,
          inclusive: false,
        },
      },
      namespace: [forum._id, userId],
    }))
  );

  for (const [index, forum] of forumsWithUnreadPotential.entries()) {
    const totalUnreadCount = totalUnreadCounts[index];
    const ownUnreadCount = ownUnreadCounts[index];

    if (totalUnreadCount === undefined || ownUnreadCount === undefined) {
      continue;
    }

    unreadCountByForumId.set(
      forum._id,
      Math.max(totalUnreadCount - ownUnreadCount, 0)
    );
  }

  return unreadCountByForumId;
}
