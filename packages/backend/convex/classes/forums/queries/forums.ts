import { query } from "@repo/backend/convex/_generated/server";
import { loadForum } from "@repo/backend/convex/classes/forums/utils/access";
import {
  getForumReactionPreviews,
  getMyForumReactions,
} from "@repo/backend/convex/classes/forums/utils/reactions";
import { getForumUnreadCounts } from "@repo/backend/convex/classes/forums/utils/unreadCounts";
import { loadClass } from "@repo/backend/convex/classes/utils";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requireClassAccess } from "@repo/backend/convex/lib/helpers/class";
import { getUserMap } from "@repo/backend/convex/lib/helpers/user";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

/**
 * List forums for one class with user reaction and unread metadata.
 */
export const getForums = query({
  args: {
    classId: vv.id("schoolClasses"),
    paginationOpts: paginationOptsValidator,
    q: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const classData = await loadClass(ctx, args.classId);
    await requireClassAccess(
      ctx,
      args.classId,
      classData.schoolId,
      user.appUser._id
    );

    const forumsPage =
      args.q && args.q.trim().length > 0
        ? await ctx.db
            .query("schoolClassForums")
            .withSearchIndex("search_title", (q) =>
              q.search("title", args.q ?? "").eq("classId", args.classId)
            )
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("schoolClassForums")
            .withIndex("by_classId_and_lastPostAt", (q) =>
              q.eq("classId", args.classId)
            )
            .order("desc")
            .paginate(args.paginationOpts);

    const forumIds = forumsPage.page.map((forum) => forum._id);
    const [userMap, myReactionsMap, unreadCountMap] = await Promise.all([
      getUserMap(
        ctx,
        forumsPage.page.map((forum) => forum.createdBy)
      ),
      getMyForumReactions(ctx, forumIds, user.appUser._id),
      getForumUnreadCounts(ctx, {
        forums: forumsPage.page,
        userId: user.appUser._id,
      }),
    ]);

    return {
      ...forumsPage,
      page: forumsPage.page.map((forum) => ({
        ...forum,
        myReactions: myReactionsMap.get(forum._id) ?? [],
        unreadCount: unreadCountMap.get(forum._id) ?? 0,
        user: userMap.get(forum.createdBy) ?? null,
      })),
    };
  },
});

/**
 * Get one forum with reaction previews for the current user.
 */
export const getForum = query({
  args: {
    forumId: vv.id("schoolClassForums"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const currentUserId = user.appUser._id;
    const forum = await loadForum(ctx, args.forumId);
    await requireClassAccess(ctx, forum.classId, forum.schoolId, currentUserId);

    const [forumUserMap, reactionPreviews, myReactionsByForum] =
      await Promise.all([
        getUserMap(ctx, [forum.createdBy]),
        getForumReactionPreviews(ctx, forum),
        getMyForumReactions(ctx, [forum._id], currentUserId),
      ]);

    return {
      ...forum,
      myReactions: myReactionsByForum.get(forum._id) ?? [],
      reactionUsers: forum.reactionCounts.map(({ emoji, count }) => ({
        count,
        emoji,
        reactors: reactionPreviews.get(emoji) ?? [],
      })),
      user: forumUserMap.get(forum.createdBy) ?? null,
    };
  },
});
