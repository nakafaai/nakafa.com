import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { QueryCtx } from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import {
  getUserMap,
  loadClass,
  requireClassAccess,
} from "@repo/backend/confect/modules/school/classAccess.service";
import {
  loadForum,
  loadForumWithAccess,
} from "@repo/backend/confect/modules/school/forums/access.service";
import { MAX_FORUM_TRANSCRIPT_POSTS } from "@repo/backend/confect/modules/school/forums/constants";
import {
  createForumFeedPosts,
  getForumUnreadCounts,
} from "@repo/backend/confect/modules/school/forums/posts.service";
import {
  getForumReactionPreviews,
  getMyForumReactions,
} from "@repo/backend/confect/modules/school/forums/reactions.service";
import type { PaginationOptions } from "convex/server";
import { Effect } from "effect";

/** Lists forum threads for a class. */
export const getForums = Effect.fn("school.forums.getForums")(function* (args: {
  classId: Id<"schoolClasses">;
  paginationOpts: PaginationOptions;
  q?: string;
}) {
  const ctx = yield* QueryCtx;
  const user = yield* requireAppUser(ctx);
  const classData = yield* loadClass(ctx, args.classId);
  yield* requireClassAccess(
    ctx,
    args.classId,
    classData.schoolId,
    user.appUser._id
  );
  const searchQuery = args.q?.trim();
  const forumsPage = searchQuery
    ? yield* Effect.promise(() =>
        ctx.db
          .query("schoolClassForums")
          .withSearchIndex("search_title", (query) =>
            query.search("title", searchQuery).eq("classId", args.classId)
          )
          .paginate(args.paginationOpts)
      )
    : yield* Effect.promise(() =>
        ctx.db
          .query("schoolClassForums")
          .withIndex("by_classId_and_lastPostAt", (query) =>
            query.eq("classId", args.classId)
          )
          .order("desc")
          .paginate(args.paginationOpts)
      );
  const forumIds = forumsPage.page.map((forum) => forum._id);
  const userMap = yield* getUserMap(
    ctx,
    forumsPage.page.map((forum) => forum.createdBy)
  );
  const myReactionsMap = yield* getMyForumReactions(
    ctx,
    forumIds,
    user.appUser._id
  );
  const unreadCountMap = yield* getForumUnreadCounts(ctx, {
    forums: forumsPage.page,
    userId: user.appUser._id,
  });

  return {
    ...forumsPage,
    page: forumsPage.page.map((forum) => ({
      ...forum,
      myReactions: myReactionsMap.get(forum._id) ?? [],
      unreadCount: unreadCountMap.get(forum._id) ?? 0,
      user: userMap.get(forum.createdBy) ?? null,
    })),
  };
});

/** Reads one forum with reaction previews. */
export const getForum = Effect.fn("school.forums.getForum")(function* (args: {
  forumId: Id<"schoolClassForums">;
}) {
  const ctx = yield* QueryCtx;
  const user = yield* requireAppUser(ctx);
  const currentUserId = user.appUser._id;
  const forum = yield* loadForum(ctx, args.forumId);
  yield* requireClassAccess(ctx, forum.classId, forum.schoolId, currentUserId);
  const forumUserMap = yield* getUserMap(ctx, [forum.createdBy]);
  const reactionPreviews = yield* getForumReactionPreviews(ctx, forum);
  const myReactionsByForum = yield* getMyForumReactions(
    ctx,
    [forum._id],
    currentUserId
  );

  return {
    ...forum,
    myReactions: myReactionsByForum.get(forum._id) ?? [],
    reactionUsers: forum.reactionCounts.map(({ count, emoji }) => ({
      count,
      emoji,
      reactors: reactionPreviews.get(emoji) ?? [],
    })),
    user: forumUserMap.get(forum.createdBy) ?? null,
  };
});

/** Reads the bounded forum post transcript. */
export const getForumPosts = Effect.fn("school.forums.getForumPosts")(
  function* (args: { forumId: Id<"schoolClassForums"> }) {
    const ctx = yield* QueryCtx;
    const user = yield* requireAppUser(ctx);
    const currentUserId = user.appUser._id;
    yield* loadForumWithAccess(ctx, args.forumId, currentUserId);
    const posts = yield* Effect.promise(() =>
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("by_forumId_and_sequence", (query) =>
          query.eq("forumId", args.forumId)
        )
        .order("desc")
        .take(MAX_FORUM_TRANSCRIPT_POSTS)
    );

    return yield* createForumFeedPosts(ctx, {
      currentUserId,
      forumId: args.forumId,
      posts: posts.reverse(),
    });
  }
);
