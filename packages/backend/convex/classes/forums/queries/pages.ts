import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { query } from "@repo/backend/convex/_generated/server";
import { loadForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import { enrichForumPosts } from "@repo/backend/convex/classes/forums/utils/posts";
import {
  forumPostAnchorValidator,
  forumPostsWindowValidator,
  forumPostWindowIndexKeyValidator,
} from "@repo/backend/convex/classes/forums/validators";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import schema from "@repo/backend/convex/schema";
import { ConvexError, v } from "convex/values";
import { getPage, type IndexKey } from "convex-helpers/server/pagination";

const DEFAULT_FORUM_WINDOW_SIZE = 25;
const FORUM_MAX_SEQUENCE = Number.MAX_SAFE_INTEGER;
const FORUM_MIN_SEQUENCE = 0;

/** Returns the lowest index key that still belongs to one forum. */
function getForumStartIndexKey(forumId: Id<"schoolClassForums">) {
  return [forumId, FORUM_MIN_SEQUENCE];
}

/** Returns the highest index key that still belongs to one forum. */
function getForumEndIndexKey(forumId: Id<"schoolClassForums">) {
  return [forumId, FORUM_MAX_SEQUENCE];
}

/** Normalizes Convex helper index keys into the exact string/number payload we expose. */
function normalizeForumWindowIndexKeys(indexKeys: IndexKey[]) {
  return indexKeys.map((indexKey) =>
    indexKey.map((value) => {
      if (typeof value === "number" || typeof value === "string") {
        return value;
      }

      throw new ConvexError({
        code: "FORUM_WINDOW_INDEX_KEY_INVALID",
        message: "Forum transcript index key contains an unsupported value.",
      });
    })
  );
}

/**
 * Returns one fully bounded manual pagination window for a forum transcript.
 *
 * References:
 * - https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#manual-pagination
 * - node_modules/.pnpm/convex-helpers@0.1.114_@standard-schema+spec@1.1.0_convex@1.35.1_react@19.2.5__hono@4.1_d6c6a33709e7cf3bf0a50d88776821f6/node_modules/convex-helpers/server/pagination.ts
 */
export const getForumPostsWindow = query({
  args: {
    endInclusive: v.optional(v.boolean()),
    endIndexKey: v.optional(forumPostWindowIndexKeyValidator),
    forumId: vv.id("schoolClassForums"),
    numItems: v.optional(v.number()),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    startInclusive: v.optional(v.boolean()),
    startIndexKey: v.optional(forumPostWindowIndexKeyValidator),
  },
  returns: forumPostsWindowValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const currentUserId = user.appUser._id;

    await loadForumWithAccess(ctx, args.forumId, currentUserId);

    const [postsWindow, readState] = await Promise.all([
      getPage(ctx, {
        table: "schoolClassForumPosts",
        index: "by_forumId_and_sequence",
        schema,
        absoluteMaxRows: args.numItems ?? DEFAULT_FORUM_WINDOW_SIZE,
        endInclusive: args.endInclusive,
        endIndexKey: args.endIndexKey ?? getForumStartIndexKey(args.forumId),
        order: args.order,
        startInclusive: args.startInclusive,
        startIndexKey: args.startIndexKey ?? getForumEndIndexKey(args.forumId),
        targetMaxRows: args.numItems ?? DEFAULT_FORUM_WINDOW_SIZE,
      }),
      ctx.db
        .query("schoolClassForumReadStates")
        .withIndex("by_forumId_and_userId", (q) =>
          q.eq("forumId", args.forumId).eq("userId", currentUserId)
        )
        .unique(),
    ]);

    const enrichedPosts = await enrichForumPosts(
      ctx,
      postsWindow.page,
      currentUserId
    );
    const lastReadSequence = readState?.lastReadSequence ?? 0;

    return {
      ...postsWindow,
      indexKeys: normalizeForumWindowIndexKeys(postsWindow.indexKeys),
      page: enrichedPosts.map((post) => ({
        ...post,
        isUnread:
          post.createdBy !== currentUserId && post.sequence > lastReadSequence,
      })),
    };
  },
});

/** Returns the stable index key for one target forum post. */
export const getForumPostAnchor = query({
  args: {
    forumId: vv.id("schoolClassForums"),
    postId: vv.id("schoolClassForumPosts"),
  },
  returns: forumPostAnchorValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const currentUserId = user.appUser._id;

    await loadForumWithAccess(ctx, args.forumId, currentUserId);

    const post = await ctx.db.get(args.postId);

    if (!post || post.forumId !== args.forumId) {
      throw new ConvexError({
        code: "FORUM_POST_NOT_FOUND",
        message: "Forum post not found.",
      });
    }

    return {
      indexKey: [post.forumId, post.sequence, post._creationTime, post._id],
      postId: post._id,
    };
  },
});
