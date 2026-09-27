import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
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
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
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
    const user = yield* requireAuth();
    const classData = yield* loadClass(args.classId);
    yield* requireClassAccess(
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
      getUserMap(forumsPage.page.map((forum) => forum.createdBy)),
      getMyForumReactions(forumIds, user.appUser._id),
      getForumUnreadCounts({
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
    const user = yield* requireAuth();
    const currentUserId = user.appUser._id;
    const forum = yield* loadForum(args.forumId);
    yield* requireClassAccess(forum.classId, forum.schoolId, currentUserId);
    const [forumUserMap, reactionPreviews, myReactions] = yield* Effect.all([
      getUserMap([forum.createdBy]),
      getForumReactionPreviews(forum),
      getMyForumReactions([forum._id], currentUserId),
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
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
