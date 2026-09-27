import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { loadForumWithAccess } from "@repo/backend/confect/classes/forums/access";
import { MAX_FORUM_TRANSCRIPT_POSTS } from "@repo/backend/confect/classes/forums/constants";
import spec from "@repo/backend/confect/classes/forums/queries/pages.spec";
import { createForumFeedPosts } from "@repo/backend/confect/classes/forums/transcript";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

const getForumPosts = FunctionImpl.make(
  databaseSchema,
  spec,
  "getForumPosts",
  Effect.fn("classes.forums.transcript.getForumPosts")(function* (args) {
    const database = yield* DatabaseReader;
    const user = yield* requireAuth();
    const currentUserId = user.appUser._id;
    yield* loadForumWithAccess(args.forumId, currentUserId);
    const posts = yield* database
      .table("schoolClassForumPosts")
      .index(
        "by_forumId_and_sequence",
        (q) => q.eq("forumId", args.forumId),
        "desc"
      )
      .take(MAX_FORUM_TRANSCRIPT_POSTS)
      .pipe(Effect.orDie);
    return yield* createForumFeedPosts({
      currentUserId,
      forumId: args.forumId,
      posts: [...posts].reverse(),
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getForumPosts),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
