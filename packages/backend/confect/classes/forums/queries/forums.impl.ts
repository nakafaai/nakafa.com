import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  QueryCtx as QueryCtxService,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  loadClass,
  requireClassAccess,
} from "@repo/backend/confect/classes/access";
import { loadForum } from "@repo/backend/confect/classes/forums/access";
import spec from "@repo/backend/confect/classes/forums/queries/forums.spec";
import {
  getForumReactionPreviews,
  getMyForumReactions,
} from "@repo/backend/confect/classes/forums/reactions";
import { getForumUnreadCounts } from "@repo/backend/confect/classes/forums/unread";
import { getUserMap } from "@repo/backend/confect/users/directory";
import { Effect, Layer } from "effect";

/**
 * List forums for one class with user reaction and unread metadata.
 */
const getForums = FunctionImpl.make(
  databaseSchema,
  spec,
  "getForums",
  Effect.fn("classes.forums.queries.forums.getForums")(function* (args) {
    const database = yield* DatabaseReader;
    const ctx = yield* QueryCtxService;
    const user = yield* requireAuth(ctx);
    const classData = yield* loadClass(ctx, args.classId);
    yield* requireClassAccess(
      ctx,
      args.classId,
      classData.schoolId,
      user.appUser._id
    );
    const searchQuery = args.q?.trim();
    const forumsPage =
      searchQuery && searchQuery.length > 0
        ? yield* database
            .table("schoolClassForums")
            .search("search_title", (q) =>
              q.search("title", searchQuery).eq("classId", args.classId)
            )
            .paginate(args.paginationOpts)
            .pipe(Effect.orDie)
        : yield* database
            .table("schoolClassForums")
            .index(
              "by_classId_and_lastPostAt",
              (q) => q.eq("classId", args.classId),
              "desc"
            )
            .paginate(args.paginationOpts)
            .pipe(Effect.orDie);
    const forumIds = forumsPage.page.map((forum) => forum._id);
    const [userMap, myReactions, unreadCounts] = yield* Effect.all([
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
      page: forumsPage.page.map((forum, index) => ({
        ...forum,
        myReactions: myReactions[index],
        unreadCount: unreadCounts[index],
        user: userMap.get(forum.createdBy) ?? null,
      })),
    };
  })
);
const getForum = FunctionImpl.make(
  databaseSchema,
  spec,
  "getForum",
  Effect.fn("classes.forums.queries.forums.getForum")(function* (args) {
    const ctx = yield* QueryCtxService;
    const user = yield* requireAuth(ctx);
    const currentUserId = user.appUser._id;
    const forum = yield* loadForum(ctx, args.forumId);
    yield* requireClassAccess(
      ctx,
      forum.classId,
      forum.schoolId,
      currentUserId
    );
    const [forumUserMap, reactionPreviews, myReactions] = yield* Effect.all([
      getUserMap(ctx, [forum.createdBy]),
      getForumReactionPreviews(ctx, forum),
      getMyForumReactions(ctx, [forum._id], currentUserId),
    ]);
    return {
      ...forum,
      myReactions: myReactions[0],
      reactionUsers: reactionPreviews,
      user: forumUserMap.get(forum.createdBy) ?? null,
    };
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getForums),
  Layer.provide(getForum),
  GroupImpl.finalize
);
